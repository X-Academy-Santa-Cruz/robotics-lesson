# Lesson: Git Basics

Git is a **version control system** — it keeps a history of every change
made to the code in this project, who made it, and why. For this course,
it's also how you'll get the lesson code onto the Pi and submit your own
work.

## 1. Why version control?

Without it, "undo" only goes back a few keystrokes and there's no record of
who changed what. With git:

- Every saved change (a **commit**) is kept forever and can be compared or
  restored
- Multiple people can work on the same code without overwriting each other
- You always have a backup on a remote server (e.g. GitHub)

## 2. Core concepts

| Term | Meaning |
|---|---|
| **Repository (repo)** | A project folder tracked by git — this whole `robotics-lesson` folder is one |
| **Commit** | A saved snapshot of changes, with a message describing what changed |
| **Remote** | A copy of the repo hosted elsewhere (e.g. GitHub) that you push to / pull from |
| **Branch** | An independent line of development — `main` is the default branch |
| **Clone** | Download a copy of a remote repo onto your machine |
| **Staging area** | Where you put changes before committing them (so you can commit a few files at a time, not everything at once) |

## 3. Getting a copy of this repo

```bash
git clone https://github.com/X-Academy-Santa-Cruz/robotics-lesson.git
cd robotics-lesson
```

This downloads the full history, not just the latest files.

### Run the setup script

Once you have cloned the repo onto the Raspberry Pi (Ubuntu), run the
setup script one time from the top of the repo. It gets the Pi ready for
every lesson in one step:

```bash
bash setup.sh
```

It will ask for your password (it uses `sudo`). It updates the package
lists, then installs:

- **pip3** (`python3-pip`) and a few build basics
- the **camera** packages (`python3-opencv`, `python3-flask`, `python3-click`)
- the **joystick** package (`python3-pygame`)
- the **I2C** tools (`i2c-tools`, `python3-smbus`)
- the **SparkFun Pi Servo HAT** library (`pi-servo-hat`) for the thrusters

It also enables the **I2C** bus and adds you to the `i2c` group so the Servo
HAT works. When it finishes:

1. Reboot if it tells you to (I2C was just turned on), and log out and back
   in if it added you to the `i2c` group.
2. Confirm the Servo HAT is on the bus — it should show up at address `40`:

   ```bash
   i2cdetect -y 1
   ```

Re-running `setup.sh` later is safe. Each lesson folder also has narrower
install notes if you ever want to set up just one lesson.

## 4. The everyday workflow

```bash
git status              # what's changed? what's staged?
git add <file>           # stage a specific file
git add .                 # stage everything that changed
git commit -m "Short description of what changed and why"
git push                 # upload your commits to the remote
```

`git status` is your best friend — run it constantly. It tells you exactly
what state you're in and often suggests the next command.

To get other people's latest changes:

```bash
git pull
```

## 5. Checking your history

```bash
git log                  # full commit history
git log --oneline        # one line per commit, easier to scan
git diff                 # see exactly what lines changed, unstaged
git diff --staged        # see what's staged for the next commit
```

## 6. Writing a good commit message

- First line: short summary (under ~70 characters), describing **why**, not
  just what — "Fix camera index for USB webcam" is better than "fix bug"
- Commit small, related changes together — not "everything I did today"

## 7. Ignoring files you don't want tracked

Some files shouldn't go into git at all — compiled files, virtual
environments, secrets. This repo already has a `.gitignore` file listing
patterns git should skip. If you create a `venv/` folder, it's already
ignored for you.

## 8. Branches (when you need them)

A branch lets you try something without touching the working `main` branch:

```bash
git checkout -b my-feature   # create and switch to a new branch
# ... make changes, commit them ...
git checkout main             # switch back to main
git merge my-feature          # bring those changes into main
```

For this course, your instructor will tell you whether to work directly on
`main` or use a branch per lesson/assignment.

## 9. Fixing mistakes (the safe way)

- Made a typo in your last commit message? `git commit --amend` (only if you
  haven't pushed yet)
- Want to see what a file looked like before your changes? `git diff <file>`
- Accidentally changed a file and want to throw away the edits?
  `git checkout -- <file>` — **this discards the changes permanently**, so
  check `git diff` first

## Exercises

1. Clone this repository (if you haven't already).
2. Create a new file in a scratch folder, e.g. `practice/hello.txt`, with
   a sentence in it.
3. Run `git status` and read the output.
4. Stage it with `git add`, commit it with a clear message, and run
   `git log --oneline` to confirm it's there.
5. Delete the file, run `git status` again, and notice how git reports a
   deletion the same way it reports an edit.
