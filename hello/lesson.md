# Lesson: Hello, World — your first app in PyCharm

Before writing ROV code, make sure your tools work by running the smallest
possible program: one that prints a message. This also walks you through
running a program in **PyCharm**, which you'll use for every lesson after this.

## The program

[`hello.py`](hello.py) is a few lines long:

```python
def main():
    print("Hello, world! - X Academy Underwater Robotics")
    name = "ROV"
    print(f"Ready to build an {name}.")


if __name__ == "__main__":
    main()
```

- `print(...)` writes a line of text to the screen.
- The `f"... {name} ..."` is an **f-string** — Python drops the value of
  `name` into the text.
- The `if __name__ == "__main__":` line means "run `main()` when this file is
  run directly." You'll see this pattern in every program in the course.

## Running it from the terminal

The simplest way, in a terminal (see the Raspberry Pi and Linux lesson):

```bash
cd robotics-lesson/hello
python3 hello.py
```

You should see:

```
Hello, world! - X Academy Underwater Robotics
Ready to build an ROV.
```

## Running it in PyCharm

PyCharm is the editor you'll use for the rest of the course. Here's the whole
loop on this tiny program first.

1. **Open the project.** In PyCharm choose **File > Open...** and select the
   `robotics-lesson` folder. (The full remote-Pi setup is covered in the
   PyCharm lesson; for this first program you can run it right on the Pi.)
2. **Open the file.** In the Project panel on the left, expand `hello` and
   double-click `hello.py`.
3. **Run it.** Right-click anywhere in the editor and choose
   **Run 'hello'**, or click the green ▶ button at the top right.
4. **See the output.** The **Run** tool window opens at the bottom and shows:

   ```
   Hello, world! - X Academy Underwater Robotics
   Ready to build an ROV.

   Process finished with exit code 0
   ```

   `exit code 0` means the program ran and finished cleanly.
5. **Make a change and re-run.** Change the message in the first `print(...)`,
   then click ▶ again and watch the output change. That edit-run-look loop is
   how you'll work for the rest of the course.

> If PyCharm shows a red error about "No interpreter," it doesn't know which
> Python to use yet. For a program running on the Pi, point it at the Pi's
> Python — the PyCharm lesson walks through setting up the interpreter.

## Exercises

1. Run `hello.py` from the terminal **and** from PyCharm.
2. Change the message to include your own name, re-run, and confirm the new
   text appears in the Run window.
3. Add a third `print(...)` line of your own and run it again.

## Reference

- **Python** — the language reference and tutorial:
  <https://docs.python.org/3/tutorial/> (print:
  <https://docs.python.org/3/library/functions.html#print>)
- **PyCharm** — running and debugging code:
  <https://www.jetbrains.com/help/pycharm/running-applications.html>

<!-- course-flow-nav -->
---

### Where this lesson fits

Step 2 of 11 in the course. ← Previous: **Raspberry Pi & Linux** (`../shell/lesson.md`) &nbsp;&nbsp;|&nbsp;&nbsp; Next: **Git Basics** (`../git/lesson.md`) →
