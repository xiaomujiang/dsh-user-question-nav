#!/bin/bash
# ============================================================
#  dsh-user-question-nav 安装 / 升级脚本（DSH Desktop 专用）
#  双击 .command 文件即可运行（macOS）
#  首次运行 = 安装，之后运行 = 升级
#
#  安装策略：将构建产物复制到稳定目录 ~/.dsh/plugins/，
#  避免 link 开发目录导致 git 操作触发 DSH Desktop 重启。
# ============================================================
set -euo pipefail

# 插件源码目录 = 本脚本所在目录（仓库根目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_SRC="$SCRIPT_DIR"

# 稳定安装目录（脱离开发目录，避免 git 操作触发 DSH Desktop 重启）
PLUGIN_STABLE="$HOME/.dsh/plugins/dsh-user-question-nav"

# DSH Desktop 客户端使用 desktop profile
PROFILE_DIR="$HOME/.dsh/profiles/desktop"
PACKAGE_JSON="$PROFILE_DIR/package.json"
PATCH_YML="$PROFILE_DIR/cordis.patch.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${CYAN}[*]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; }

# ------ 检查前置条件 ------
check_prereqs() {
  local missing=()
  command -v pnpm  >/dev/null 2>&1 || missing+=(pnpm)
  command -v node  >/dev/null 2>&1 || missing+=(node)

  if [[ ${#missing[@]} -gt 0 ]]; then
    err "缺少前置工具: ${missing[*]}"
    echo "请先安装: brew install node pnpm"
    exit 1
  fi

  if [[ ! -d "$PROFILE_DIR" ]]; then
    err "DSH Desktop profile 目录不存在: $PROFILE_DIR"
    echo "请先运行一次 DSH Desktop 客户端，让它初始化 profile"
    exit 1
  fi

  if [[ ! -f "$PLUGIN_SRC/package.json" ]]; then
    err "插件目录不完整: $PLUGIN_SRC"
    echo "请确保本脚本放在 dsh-user-question-nav 目录中"
    exit 1
  fi

  ok "前置检查通过"
}

# ------ 构建 + 复制到稳定目录 ------
build_and_copy() {
  cd "$PLUGIN_SRC"

  log "安装依赖..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  ok "pnpm install 完成"

  log "构建插件..."
  pnpm build
  ok "pnpm build 完成"

  log "复制到稳定安装目录..."
  mkdir -p "$PLUGIN_STABLE"
  rm -rf "$PLUGIN_STABLE/lib"
  cp -r "$PLUGIN_SRC/lib"         "$PLUGIN_STABLE/"
  cp "$PLUGIN_SRC/package.json"   "$PLUGIN_STABLE/"
  cp "$PLUGIN_SRC/dsh.plugin.json" "$PLUGIN_STABLE/"
  cp "$PLUGIN_SRC/cordis.patch.yml" "$PLUGIN_STABLE/"
  ok "已复制到 $PLUGIN_STABLE"
}

# ------ 更新 profile 的 package.json ------
update_package_json() {
  log "检查 package.json 依赖..."

  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$PACKAGE_JSON', 'utf8'));
    const stablePath = '$PLUGIN_STABLE';
    let changed = false;

    if (!pkg.dependencies) pkg.dependencies = {};

    if (pkg.dependencies['dsh-user-question-nav'] === 'link:' + stablePath) {
      console.log('依赖已是稳定目录 link，跳过');
    } else {
      if (pkg.dependencies['dsh-user-question-nav']) {
        console.log('依赖存在但指向旧路径，替换为稳定目录');
      } else {
        console.log('添加 link 依赖 → 稳定目录');
      }
      pkg.dependencies['dsh-user-question-nav'] = 'link:' + stablePath;
      changed = true;
    }

    if (changed) {
      fs.writeFileSync('$PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\n');
      console.log('package.json 已更新');
    }
  " || { err "更新 package.json 失败"; exit 1; }
}

# ------ 更新 profile 的 cordis.patch.yml ------
update_patch_yml() {
  log "检查 cordis.patch.yml 挂载..."

  node -e "
    const fs = require('fs');
    let content = fs.readFileSync('$PATCH_YML', 'utf8');

    if (content.includes('id: user-question-nav') || content.includes(\"id: 'user-question-nav'\")) {
      console.log('挂载行已存在，跳过');
      process.exit(0);
    }

    const entry = '\n# dsh-user-question-nav 挂载（由 install.command 自动添加）\n- insert:\n    - id: user-question-nav\n      name: '\"'\"'dsh-user-question-nav'\"'\"'\n      config: {}\n';

    if (/^\s*\[\]\s*$/m.test(content)) {
      content = content.replace(/^\s*\[\]\s*$/m, entry.trimStart());
    } else {
      content = content.trimEnd() + '\n' + entry;
    }

    fs.writeFileSync('$PATCH_YML', content);
    console.log('cordis.patch.yml 已更新（挂载行已追加）');
  " || { err "更新 cordis.patch.yml 失败"; exit 1; }
}

# ------ 安装 profile 依赖 ------
install_profile() {
  cd "$PROFILE_DIR"
  log "安装 profile 依赖..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  ok "pnpm install 完成"
}

# ------ 主流程 ------
main() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║   dsh-user-question-nav 安装/升级（Desktop 专用）║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  源码目录: ${GREEN}$PLUGIN_SRC${NC}"
  echo -e "  安装目录: ${GREEN}$PLUGIN_STABLE${NC}"
  echo -e "  Profile  : ${GREEN}$PROFILE_DIR${NC}"
  echo ""
  echo -e "  功能: ↑↓ 双箭头按钮快速定位上一个/下一个用户问题"
  echo ""

  check_prereqs
  build_and_copy
  update_package_json
  update_patch_yml
  install_profile

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                  安装完成！                      ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${YELLOW}▸ 请重启 DSH Desktop 让插件生效：${NC}"
  echo -e "    1. ${YELLOW}Cmd+Q${NC} 完全退出 DSH Desktop"
  echo -e "    2. 重新打开 DSH Desktop"
  echo -e "    3. 打开任意对话，右侧会出现 ⏫⏬ 导航按钮"
  echo ""
  echo -e "  ${CYAN}提示：${NC}插件安装在独立目录，后续在源码目录做 git 操作"
  echo -e "        不会影响已安装的插件，无需反复强刷。"
  echo -e "        升级时重新双击本脚本即可。"
  echo ""

  if [[ "$(uname)" == "Darwin" ]]; then
    echo "按任意键关闭此窗口..."
    read -r
  fi
}

main