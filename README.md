# DSLC Sequential Decision Analytics and Modeling (2e) Book Club

Welcome to the DSLC Sequential Decision Analytics and Modeling (2e) Book Club!

We are working together to read [_Sequential Decision Analytics and Modeling (2e)_](https://castle.princeton.edu/sdamodeling/) by Warren B. Powell (copyright 2026).

Join the [#book_club-sdamodeling](https://app.slack.com/client/T6UC1DKJQ/C0BM0PAP3E3) channel on the [DSLC Slack](https://dslc.io/join) to participate.
As we read, we are producing [slides about the book](https://AngelFelizR.github.io/bookclub-sdamodeling).

## Meeting Schedule

If you would like to present, please see the sign-up sheet for your cohort (linked below, and pinned in the [#book_club-sdamodeling](https://dslcio.slack.com/archives/C09PYM1R332) channel on Slack)!

- [Cohort 1](https://docs.google.com/spreadsheets/d/1u7XiaM3OyQe-EkYdBJ0WO8-E9Iv8goq-pvy9ouWJ4Sk/edit?usp=sharing) (started 2026-10-12, facilitated by Ángel Féliz): [Mondays, 3:00 PM CST/CDT](https://www.timeanddate.com/worldclock/converter.html?iso=20261012T110000&p1=230&p2=179&p3=248) | [meeting videos](https://www.youtube.com/playlist?list=PLLQZd6pMgcUA)

<hr>


## How to Present

This repository is structured as a Quarto website.
To present, follow these instructions:

Do these steps once in RStudio or Positron:

1. [Setup Git and GitHub to work with RStudio](https://github.com/r4ds/bookclub-setup) (click through for detailed, step-by-step instructions; I recommend checking this out even if you're pretty sure you're all set).
2. `usethis::create_from_github("AngelFelizR/bookclub-sdamodeling")` (cleanly creates your own copy of this repository; if you don't have write access, `usethis` will offer to create a fork for you under your account).

Do these steps each time you present another chapter:

1. Open your project for this book.
2. `usethis::pr_init("my-chapter")` (creates a branch for your work, to avoid confusion, making sure that you have the latest changes from other contributors; replace `my-chapter` with a descriptive name, ideally).
3. `pak::pak()` (installs any R packages used by the book that you don't already have installed). If you will run Python code in your slides, also run `pip install .` in a terminal from the project folder; that installs the Python packages listed in `pyproject.toml` (see [Adding Python packages](#adding-python-packages)).
4. Edit the appropriate chapter file (in `slides/`). Use `#` (section) and `##` (slide) to indicate new slides. You do *not* need to update the `_quarto.yml` index; it automatically finds chapter slide files. If the chapter file does not exist, copy another chapter file and rename it appropriately (e.g., `02.qmd` for chapter 2). Make sure to update the title at the top of the file!
5. Add any new packages you used (see [Adding R packages](#adding-r-packages) and [Adding Python packages](#adding-python-packages)).
6. Preview your changes! ctrl-shift-k (or command-shift-k) will render the current slide + anything that you haven't rendered before in RStudio or Positron. Please do this to make sure it works before you push your changes up to the main repo! Note: When the site builds on your machine, you'll get some untracked files (`01.qmd` etc in the root directory) and directories (`_site` and `.quarto`). Ignore these files; they're generated during the render, and *should* automatically update when you re-render. If you're having trouble rendering, try deleting old copies of these files/directories on your local machine; sometimes quarto gets "stuck." You might also need to delete something in `_freeze` if things aren't updating properly on something you've edited.
7. Commit your changes (through the command line, using Rstudio's Git tab, or using Positron's Source Control section). The exact message usually isn't important, but something like "Updates to chapter 2 slides" is enough.
8. `usethis::pr_push()` (pushes the changes up to github, and opens a "pull request" (PR) to let us know your work is ready). Note: This will open GitHub in a browser window, so you might want to open a browser and login to GitHub.com before this runs.
9. (If we request changes, make them)
10. When your PR has been accepted ("merged"), `usethis::pr_finish()` to close out your branch and prepare your local repository for future work.
11. Now that your local copy is up-to-date with the main repo, you need to update your remote fork. Run `gert::git_push("origin")` or click the `Push` button on the `Git` tab of Rstudio.

When your PR is checked into the main branch, the quarto site will rebuild, adding your slides to [this site](https://AngelFelizR.github.io/bookclub-sdamodeling).

## Contributing: pull requests only

The `main` branch is protected:

- **Nobody can push directly to `main`.** Every change (including changes made by maintainers) must arrive through a pull request.
- Every pull request must pass the **`render_site`** continuous-integration check (it renders the whole website with Quarto, so broken slides are caught before merging).
- Once your PR is merged, the **Render and deploy site** workflow runs automatically.

Only pull requests into `AngelFelizR/bookclub-sdamodeling` are considered; that repository is the upstream home of this book club.

### How the site is built and published

- Pull requests: the `pr_check` workflow renders the site to HTML and fails the check if anything breaks. No HTML is committed anywhere.
- Pushes to `main`: the `build_site` workflow renders the site and publishes it **to the `gh-pages` branch** with `quarto publish gh-pages`.
- GitHub Pages serves the content of `gh-pages`, so the generated HTML lives only on that branch — never on `main` (the `.gitignore` already excludes `*.html` and `_site/`).
- The published site is at <https://AngelFelizR.github.io/bookclub-sdamodeling> (GitHub Pages, served from the `gh-pages` branch).

## Adding R packages

If you use an R package that is not already listed in the `DESCRIPTION` file, add it there.
The quickest way is:

```r
usethis::use_package("myCoolPackage")
```

`DESCRIPTION` is the single source of truth for R dependencies: CI installs everything listed in it (via `r-lib/actions/setup-r-dependencies`) before rendering.

## Adding Python packages

Slides can contain executable Python code. Quarto runs those slides with the **Jupyter** engine, and continuous integration installs your Python packages on every pull request and every deploy, so the code in your slides is actually executed when the site is built.

There are two things you need to do:

### 1. Declare the engine in your slide file

Quarto uses the `knitr` (R) engine by default, so any `.qmd` file that runs Python code must opt in with `engine: jupyter` in its YAML header:

```yaml
---
engine: jupyter
title: Chapter 3 slides
---
```

You can mix the two engines across files in the same site: R slides keep the default engine, Python slides declare `engine: jupyter`.

### 2. Add the package to `pyproject.toml`

Python packages are declared in the `dependencies` list of [`pyproject.toml`](pyproject.toml).
Add one quoted package per line (no `pip install` commands are run by hand in CI):

```toml
dependencies = [
  "numpy",
  "pandas",
  "matplotlib",
]
```

If you need a specific version, use the usual pip syntax, e.g. `"pandas>=2.2"`.

### What CI does with that file

On every pull request and on every deploy, the workflows run:

```yaml
- name: Set up Python
  uses: actions/setup-python@v5
  with:
    python-version: '3.12'

- name: Install Python packages
  run: |
    python -m pip install --upgrade pip
    pip install jupyter ipykernel
    pip install .
```

- `pip install jupyter ipykernel` gives Quarto's Jupyter engine what it needs to execute cells.
- `pip install .` installs **your** package list: it reads the `dependencies` array from `pyproject.toml`. Nothing else needs to be added to the workflows.

### Reproducing CI on your machine

Once per clone, run from the project folder:

```sh
pip install jupyter ipykernel
pip install .
```

After that, previewing a Python slide (ctrl/command-shift-k) behaves exactly like CI. If you add a new package to `pyproject.toml`, run `pip install .` again locally.

## Code of Conduct

Please note that the bookclub-sdamodeling project is released with a [Contributor Code of Conduct](https://contributor-covenant.org/version/2/1/CODE_OF_CONDUCT.html). By contributing to this project, you agree to abide by its terms.
