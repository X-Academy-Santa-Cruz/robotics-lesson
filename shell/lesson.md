# Lesson: Linux Shell Basics

Your ROV's "brain" is a Raspberry Pi running Ubuntu with no monitor or mouse
attached to it — it's sealed inside the ROV. The only way to talk to it is
through a terminal, typing commands into a **shell**. This lesson covers the
commands you'll use constantly for the rest of the course.

## 1. Connecting to the Pi

The Pi runs "headless" (no screen). You connect to it over the network from
your laptop using SSH (Secure Shell):

```bash
ssh ubuntu@<pi-ip-address>
```

Replace `<pi-ip-address>` with the Pi's address on the network (ask your
instructor, or find it with `hostname -I` if you already have a terminal open
on the Pi). The first time you connect, it'll ask if you trust the host —
type `yes`. Then enter the Pi's password.

Everything below works the same whether you're typing directly on the Pi or
through an SSH connection — SSH just gives you a terminal on a remote machine.

## 2. Where am I? Where is everything?

| Command | What it does |
|---|---|
| `pwd` | **P**rint **w**orking **d**irectory — shows the folder you're currently in |
| `ls` | **L**i**s**t the files/folders in the current directory |
| `ls -l` | List with details: permissions, size, modified date |
| `ls -a` | List including hidden files (names starting with `.`) |
| `cd <folder>` | **C**hange **d**irectory into `<folder>` |
| `cd ..` | Go up one level (to the parent folder) |
| `cd ~` | Jump to your home directory |

Try it:

```bash
pwd
ls -l
cd robotics-lesson
ls
```

## 3. Working with files and folders

| Command | What it does |
|---|---|
| `mkdir <name>` | Make a new directory |
| `touch <file>` | Create an empty file (or update its timestamp) |
| `cp <src> <dst>` | Copy a file |
| `mv <src> <dst>` | Move or rename a file |
| `rm <file>` | Remove (delete) a file — **no undo, no trash can** |
| `rm -r <folder>` | Remove a folder and everything in it — **be very careful** |
| `cat <file>` | Print a file's entire contents to the screen |
| `less <file>` | View a file one page at a time (press `q` to quit) |

`rm` is permanent. There's no recycle bin on a Linux server — double-check
the path before you hit enter, especially with `rm -r`.

## 4. Running programs and managing processes

| Command | What it does |
|---|---|
| `python3 stream_server.py` | Run a Python script |
| `Ctrl+C` | Stop the program currently running in your terminal |
| `python3 stream_server.py &` | Run it in the **background** so you get your terminal prompt back |
| `jobs` | List background jobs started in this terminal |
| `ps aux` | List every process running on the machine |
| `ps aux \| grep python` | List only processes with "python" in the name |
| `kill <pid>` | Stop a process by its process ID (found via `ps aux`) |

You'll use `&` and `kill` a lot once the camera server is running — you need
a way to stop it without unplugging the Pi.

## 5. Permissions (why "permission denied" happens)

`ls -l` shows something like `-rwxr-xr-x`. That's:

- Who can **r**ead, **w**rite, or e**x**ecute the file
- In three groups: the owner, the group, everyone else

If you get `Permission denied` running a script, it may need the execute bit:

```bash
chmod +x stream_server.py
```

USB cameras also show up as device files (e.g. `/dev/video0`). If your
program can't open the camera, check that your user has permission to access
it — you may need to add your user to the `video` group:

```bash
sudo usermod -aG video $USER
```

(then log out and back in for the group change to take effect.)

## 6. Python environments

We'll install Python packages (like OpenCV) using `pip`. It's good practice
to use a virtual environment so packages for this project don't clash with
other projects:

```bash
python3 -m venv venv          # create a virtual environment named "venv"
source venv/bin/activate      # activate it (your prompt will show "(venv)")
pip install -r requirements.txt
```

Run `deactivate` to leave the virtual environment.

## 7. Finding your IP address

To view the camera stream from your laptop's browser, you need the Pi's IP
address on the network:

```bash
hostname -I
```

Write it down — you'll need it in the next lesson.

## Exercise

1. SSH into the Pi.
2. Use `pwd` and `ls` to confirm you can find the `robotics-lesson` folder.
3. Create a scratch folder called `practice`, `cd` into it, create a file
   called `notes.txt` with `touch`, then delete the whole `practice` folder
   with `rm -r`.
4. Find the Pi's IP address with `hostname -I` and write it down for the
   camera lesson.
