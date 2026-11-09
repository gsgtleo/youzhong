# Ubuntu 部署手册

## 1. 打包（在开发机上）

```bash
chmod +x deploy/*.sh
npm run build
./deploy/build-package.sh
# 产物：dist-packages/youzhong-server-<version>.tar.gz
```

## 2. 安装（目标 Ubuntu）

```bash
# 依赖：Node 20+ 与编译工具（better-sqlite3 无预编译包时需要）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3

tar -xzf youzhong-server-*.tar.gz
cd youzhong-server-*
sudo ./deploy/install.sh
```

安装脚本会：

| 动作 | 位置 |
| --- | --- |
| 创建系统用户 `youzhong` | `useradd --system` |
| 复制程序 | `/opt/youzhong` |
| 数据库目录 | `/var/lib/youzhong/youzhong.db`（WAL 模式） |
| 配置（0600） | `/etc/youzhong/youzhong.env` |
| systemd 服务 | `/etc/systemd/system/youzhong.service` |
| 首次初始化管理员 | 密码写入 `youzhong.env` 并打印 |

默认监听 `0.0.0.0:10078`。安装完成后浏览器访问 `http://<IP>:10078`。

## 3. 配置项（`/etc/youzhong/youzhong.env`）

| 变量 | 说明 |
| --- | --- |
| `PORT` / `HOST` | 监听端口与地址，默认 `10078 / 0.0.0.0` |
| `DB_FILE` | SQLite 路径，默认 `/var/lib/youzhong/youzhong.db` |
| `APP_SECRET` | 加密渠道 Webhook / 密钥的主密钥，**丢失后需重配渠道** |
| `SERVER_NAME` | 登录页「测试连接」显示的服务器名 |
| `MAX_USERS` | 用户上限，默认 10 |
| `TRUST_PROXY` | 走 Nginx 反代时设为 `true`（Cookie 安全标记依赖它） |
| `ALLOWED_ORIGINS` | 允许跨域直连的来源，逗号分隔 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 仅首次初始化时生效 |

改完配置：`sudo systemctl restart youzhong`。

## 4. 日常运维

```bash
journalctl -u youzhong -f                     # 实时日志
systemctl restart youzhong                    # 重启
sqlite3 /var/lib/youzhong/youzhong.db ".backup '/var/lib/youzhong/backup/manual.db'"   # 在线备份
```

备份建议：每天定时 `sqlite3 ... .backup` 到另一块盘或 NAS。数据库单文件，迁移时连同 `APP_SECRET` 与 `youzhong.env` 一起拷走即可。

## 5. 升级 / 卸载

```bash
sudo ./deploy/upgrade.sh        # 自动备份数据库 → 替换程序 → 重启
sudo ./deploy/uninstall.sh      # 删除程序，保留 /var/lib/youzhong
sudo ./deploy/uninstall.sh --purge   # 连数据一起删除（需输入 DELETE 确认）
```

## 6. 常见问题

| 现象 | 处理 |
| --- | --- |
| 启动失败 `Cannot find module better-sqlite3` | `sudo apt install -y build-essential python3` 后执行 `cd /opt/youzhong && sudo -u youzhong npm rebuild better-sqlite3` |
| 手机连不上 | 确认同网段、`sudo ufw allow 10078/tcp`、`HOST=0.0.0.0` |
| 登录后立刻掉线 | 反代场景需 `TRUST_PROXY=true`；http 访问时不要设 `NODE_ENV=production` 之外还要求 Secure Cookie |
| 钉钉提示签名错误 | 检查加签密钥是否含 `SEC` 前缀、服务器时间是否准确（NTP） |
| 渠道密钥全部失效 | `APP_SECRET` 被改动，重新填写 Webhook 与密钥 |
## 7. 容器内自启与崩溃自愈（无 systemd）

容器如果以 `bash` 作为 PID 1（`docker run -it … bash`），容器里**没有 init**，重启后 sshd / nginx / 应用都不会自己起来。仓库里提供三个脚本，装好后互相看护：

| 脚本 | 作用 |
| --- | --- |
| `deploy/start-dida.sh` | 应用守护：崩溃自动重启（指数退避）、`/api/ping` 连续 3 次失败判定卡死并强制重启、单实例文件锁、日志 10MB 轮转 |
| `deploy/youzhong-watchdog.sh` | 巡检：每 30s 检查 sshd / nginx / 应用，掉了就拉起；应用连续 2 次不健康则强制重启守护 |
| `deploy/youzhong-bootstrap.sh` | 一键拉起：sshd + nginx + 应用守护 + 巡检（幂等，`--quiet` 供 `.bashrc` 用） |

安装（示例路径 `/n3_storage/youzhong`）：

```bash
install -m 755 deploy/start-dida.sh          /n3_storage/youzhong/scripts/start-dida.sh
install -m 755 deploy/youzhong-watchdog.sh   /usr/local/bin/youzhong-watchdog
install -m 755 deploy/youzhong-bootstrap.sh  /usr/local/bin/youzhong-bootstrap

# 容器启动时（PID1 交互 bash 会读 .bashrc）自动拉起
echo '[ -x /usr/local/bin/youzhong-bootstrap ] && /usr/local/bin/youzhong-bootstrap --quiet >/dev/null 2>&1' >> /root/.bashrc
cp /etc/profile.d/youzhong-autostart.sh …   # 可选：登录 shell 兜底
```

> 注意：脚本里所有长驻子进程都显式 `8>&-` / `9>&-` 关闭锁 fd。
> 否则 nginx / 巡检这类进程会把启动锁或守护锁一直攥住，导致下一次拉起被判定为「已在运行」而跳过。

**宿主机上还需要做两件事**（容器内改不了）：

```bash
# 1) 容器重启策略：机器重启/守护进程重启后自动拉起容器
docker update --restart unless-stopped <容器名>

# 2) 端口发布：端口只能在创建容器时指定，update 不能加
docker commit <容器名> youzhong:latest
docker rm -f <容器名>
docker run -d --name youzhong --restart unless-stopped \
  -p 20022:22 -p 31000:8000 \
  youzhong:latest /bin/bash -lc '/usr/local/bin/youzhong-bootstrap && exec sleep infinity'
```

最后这条命令让容器脱离终端（`-d`），PID 1 会先跑 bootstrap 再常驻，关掉 SSH 窗口也不会把容器带走。

### 7.1 重建容器时的“一键初始化”脚本

上面三个脚本只管「服务进程」，重建容器后还要保证软件与配置在。`deploy/youzhong-init.sh` 把这些合成一个幂等入口：

```bash
youzhong-init                  # 初始化 + 拉起全部服务
youzhong-init --quiet          # 静默（给 .bashrc / 容器入口用）
youzhong-init --foreground     # 初始化后 exec sleep infinity（给 docker run 当 PID 1）
```

它会按顺序补齐（已存在的跳过）：

| 步骤 | 内容 |
| --- | --- |
| 目录 | `$APP_ROOT/.data`、`/var/log`、`/var/run` |
| 配置 | `.env` 缺失则从 `.env.example` 生成，填好 `PORT/URL_PREFIX/DB_FILE/APK_DIR/APP_SECRET`（随机） |
| SSH | 缺 `openssh-server` 则 apt 安装；`ssh-keygen -A` 生成 host key；放行 root；启动 sshd |
| Nginx | 缺 `nginx` 则 apt 安装；`/etc/nginx/conf.d/youzhong.conf` 缺失则**优先从 `$APP_ROOT/deploy/nginx.container.conf` 恢复**（含 `/xqb` 等自定义路由），没有才写内置模板；`nginx -t` 后启动 |
| 依赖 | `node_modules` 缺失则 `npm ci` |
| 应用 | `scripts/start-dida.sh ensure`（崩溃重启 + 卡死自愈） |
| 巡检 | `youzhong-watchdog daemon` |

安装与自启钩子：

```bash
install -m 755 deploy/youzhong-init.sh /usr/local/bin/youzhong-init
echo '[ -x /usr/local/bin/youzhong-init ] && /usr/local/bin/youzhong-init --quiet >/dev/null 2>&1' >> /root/.bashrc
printf '[ -x /usr/local/bin/youzhong-init ] && /usr/local/bin/youzhong-init --quiet >/dev/null 2>&1\n' \
  > /etc/profile.d/youzhong-autostart.sh
```

推荐用下面这条命令重建容器（`-d`，不再依赖终端；PID 1 先初始化再常驻）：

```bash
docker run -d --name youzhong --restart unless-stopped \
  -p 20022:22 -p 31000:8000 \
  youzhong:latest /usr/local/bin/youzhong-init --quiet --foreground
```

**重建前请确认这些随容器走的东西已经保住**：

- 代码与数据都在 `/n3_storage/youzhong`（含 `.data/youzhong.db`、`dist-packages/`、`.env`）——建议挂卷或 `docker commit`；
- `/root/.ssh/authorized_keys`（免密登录公钥）；
- `/n3_storage/tools/node22`（Node 运行时，脚本不会自动下载）；
- `/n3_storage/youzhong/deploy/nginx.container.conf`（真实 nginx 配置备份，脚本会用它恢复）；
- 宿主机端口发布只能创建容器时指定：`-p 20022:22 -p 31000:8000`。
