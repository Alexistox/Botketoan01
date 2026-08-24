import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("159.223.49.204", username="root", password="AbC112112A", timeout=25)

cmds = [
    "cd /root/Botketoan01 && git pull origin main",
    "cd /root/Botketoan01 && git log -1 --oneline && git status -sb",
    "test ! -f /root/Botketoan01/services/subscriptionSeed.js && echo 'subscriptionSeed removed OK'",
    "pm2 restart Botketoan01 --update-env",
    "sleep 3 && pm2 show Botketoan01 | head -18",
    "tail -n 20 /root/.pm2/logs/Botketoan01-out.log",
]

for cmd in cmds:
    print("====", cmd[:110])
    _i, o, e = c.exec_command(cmd, timeout=180)
    print(o.read().decode("utf-8", "replace"))
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        print(err[:2000])

c.close()
