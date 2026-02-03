# GitHub Mirror Setup: project-genesis → garden-bloom

## Architecture

```
Local Development
       ↓ git push
project-genesis (maxfraieho)
       ↓ GitHub Action (automatic)
garden-bloom (maxfraieho)
       ↓ auto deploy
Cloudflare Pages
```

---

## Step 1: Add Secrets to `project-genesis`

URL: https://github.com/maxfraieho/project-genesis/settings/secrets/actions

### Secret 1: `SSH_PRIVATE_KEY`

Click "New repository secret", name it `SSH_PRIVATE_KEY`, paste this value:

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACDX7MNzjWX9T6nfobb7XvWkQ8mWgtkndEPZIKeSYEtOmwAAAJgxfLKOMXyy
jgAAAAtzc2gtZWQyNTUxOQAAACDX7MNzjWX9T6nfobb7XvWkQ8mWgtkndEPZIKeSYEtOmw
AAAEAxdTj7Ni4UgNlcsg5epounziXkEF6yVNOxEIgoLRyrjdfsw3ONZf1Pqd+htvte9aRD
yZaC2Sd0Q9kgp5JgS06bAAAAEHJwaTRiLW1heGZyYWllaG8BAgMEBQ==
-----END OPENSSH PRIVATE KEY-----
```

### Secret 2: `SSH_KNOWN_HOSTS`

Click "New repository secret", name it `SSH_KNOWN_HOSTS`, paste this value:

```
|1|UsRgJZ/VdMFbnQbH8L47QYI9GLY=|Z66+FnNi39c3OXGfhVCPsENBS3Q= ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=
|1|Ndeo7l9PCmmsadDWR1z7+kGaoHQ=|bkY2Ba8MLE7ZP1ukc3eSAk8rbSw= ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
|1|NjaZTcKRJkDJ4HnUsW2W2hEgSew=|ANJz1UEyby0Mm4my0FvIIbeLdKQ= ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
```

---

## Step 2: Add Deploy Key to `garden-bloom`

URL: https://github.com/maxfraieho/garden-bloom/settings/keys

Click "Add deploy key":

- **Title**: `Mirror from project-genesis`
- **Key**: (paste exactly as shown below, single line)

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINfsw3ONZf1Pqd+htvte9aRDyZaC2Sd0Q9kgp5JgS06b rpi4b-maxfraieho
```

- **Allow write access**: YES (check the box)

---

## Step 3: Verify Setup

After configuring secrets and deploy key:

1. Go to: https://github.com/maxfraieho/project-genesis/actions
2. Find workflow "Mirror Repository to Target"
3. Click "Run workflow" → "Run workflow"
4. Check that it completes successfully (green checkmark)

---

## How It Works

The workflow file `.github/workflows/mirror.yml` triggers on:
- Every push to any branch
- Every tag creation
- Every branch/tag deletion

It uses `git push --mirror` to sync all refs to garden-bloom.

---

## Troubleshooting

### "Permission denied (publickey)"

- Verify deploy key is added to garden-bloom with **write access**
- Verify SSH_PRIVATE_KEY secret contains the full key including BEGIN/END lines

### "Host key verification failed"

- Verify SSH_KNOWN_HOSTS secret is set correctly
- Regenerate if needed: `ssh-keyscan -H github.com`

### Workflow not triggering

- Check Actions are enabled: https://github.com/maxfraieho/project-genesis/settings/actions
- Verify workflow file exists at `.github/workflows/mirror.yml`

---

## Local Git Configuration

Your local remote should point to project-genesis:

```bash
git remote set-url origin git@github-maxfraieho:maxfraieho/project-genesis.git
```

SSH config (`~/.ssh/config`) should have:

```
Host github-maxfraieho
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_maxfraieho
  IdentitiesOnly yes
```

---

## Quick Reference

| Item | Value |
|------|-------|
| Source repo | `maxfraieho/project-genesis` |
| Target repo | `maxfraieho/garden-bloom` |
| Workflow file | `.github/workflows/mirror.yml` |
| SSH key file | `~/.ssh/id_ed25519_maxfraieho` |
| Deploy target | Cloudflare Pages (from garden-bloom) |
