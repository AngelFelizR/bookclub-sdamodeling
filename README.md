# DSLC Sequential Decision Analytics and Modeling (2e) Book Club

Welcome to the DSLC Sequential Decision Analytics and Modeling (2e) Book Club!

We are working together to read [_Sequential Decision Analytics and Modeling (2e)_](https://castle.princeton.edu/sdamodeling/) by Warren B. Powell (copyright 2026).

Join the [#book_club-sdamodeling](https://app.slack.com/client/T6UC1DKJQ/C0BM0PAP3E3) channel on the [DSLC Slack](https://dslc.io/join) to participate.
As we read, we are producing [slides about the book](https://AngelFelizR.github.io/bookclub-sdamodeling).

## Meeting Schedule

If you would like to present, please see the sign-up sheet for your cohort (linked below, and pinned in the [#book_club-sdamodeling](https://dslcio.slack.com/archives/C09PYM1R332) channel on Slack)!

- [Cohort 1](https://docs.google.com/spreadsheets/d/1u7XiaM3OyQe-EkYdBJ0WO8-E9Iv8goq-pvy9ouWJ4Sk/edit?usp=sharing) (started 2026-10-12, facilitated by Ángel Féliz): [Mondays, 7:00 AM AST](https://www.timeanddate.com/worldclock/converter.html?iso=20261012T110000&p1=230&p2=179&p3=248) | [meeting videos](https://www.youtube.com/playlist?list=PLLQZd6pMgcUA)

<hr>

## How to Present

This repository is a Quarto website: every slide deck is a `.qmd` file in `slides/`. The steps below are the same for everyone, whether you write your slides in R or in Python — each step shows how to do it **from R** (with [`usethis`](https://usethis.r-lib.org/) / RStudio's Git tab) and **from git** (a terminal, VS Code, or any other tool; this is the usual path if you work with Python).

### One-time setup

1. Install [git](https://git-scm.com) and an editor: RStudio or [Positron](https://positron.posit.co/) if you work in R, VS Code (or your favorite editor) if you work in Python.
2. **Get your own copy of the repository** — pick one:
   - **From R:** `usethis::create_from_github("AngelFelizR/bookclub-sdamodeling")` creates your fork on GitHub, clones it, and opens it. (If you already have write access, `usethis` clones the repository directly.)
   - **From git:** click the **Fork** button on [AngelFelizR/bookclub-sdamodeling](https://github.com/AngelFelizR/bookclub-sdamodeling) on GitHub, then:

     ```sh
     git clone git@github.com:YOUR-USER/bookclub-sdamodeling.git
     cd bookclub-sdamodeling
     ```

3. **Install R and the project's R packages** (open the project in RStudio/Positron and run `pak::pak()`). **This is required for everyone — even if your slides are 100% Python.** Quarto runs the project's pre-render script (`generate_chapters.R`, which maintains the chapter index) before *every* render or preview in this project — including rendering or previewing a *single* `.qmd` file — and that script needs R. (It only generates the index pages; it does not touch the code inside your deck.)
4. **If you will write Python slides**, install Python 3.11+ and, from the project folder:

   ```sh
   pip install jupyter ipykernel   # the engine Quarto uses to run Python
   pip install .                   # installs the packages listed in pyproject.toml
   ```

### The steps each time you present

**1. Create a branch with the latest changes**

- **From R:** `usethis::pr_init("chapter-3")` (replace `chapter-3` with a descriptive name).
- **From git:**

  ```sh
  git switch main
  git pull
  git switch -c chapter-3
  ```

**2. Edit your chapter's slides** (`slides/NN.qmd`, e.g. `slides/03.qmd` for chapter 3).

- Use `#` for a new section and `##` for a new slide.
- If the file doesn't exist yet, copy another one and rename it — and don't forget to update the title at the top!
- You do *not* need to edit `_quarto.yml`; it picks up the slide files automatically.

**3. Add the packages you used** (see [Writing slides with R](#writing-slides-with-r) or [Writing slides with Python](#writing-slides-with-python) below).

**4. Preview your slides** before pushing:

- **From R:** press `Ctrl-Shift-K` / `Cmd-Shift-K` in RStudio or Positron (renders the current file).
- **From a terminal (R or Python):** `quarto preview slides/NN.qmd`.

Previewing creates some generated files (a `NN.qmd` in the project root, plus `_site/` and `.quarto/` directories). They are ignored by git; if a preview looks stale, delete the generated files and re-render.

**5. Commit your changes**

- **From R:** use the **Git** tab in RStudio (stage your files, write a message, commit).
- **From git:**

  ```sh
  git add slides/NN.qmd DESCRIPTION pyproject.toml   # whatever you changed
  git commit -m "Slides for chapter 3"
  ```

**6. Push and open a pull request (PR)**

- **From R:** `usethis::pr_push()` (pushes the branch and opens the PR in your browser).
- **From git:**

  ```sh
  git push -u origin chapter-3
  ```

  GitHub prints a link to open the PR (or run `gh pr create` if you have the [GitHub CLI](https://cli.github.com/) installed).

**7. After your PR is merged**, clean up:

- **From R:** `usethis::pr_finish()`.
- **From git:**

  ```sh
  git switch main
  git pull
  git branch -d chapter-3
  ```

### Ground rules

- The `main` branch is protected: **nobody pushes to it directly** — every change (yours and ours) goes through a pull request, and a PR must pass its automated checks before it can be merged.
- Once your PR is merged the site rebuilds automatically and your slides appear at <https://AngelFelizR.github.io/bookclub-sdamodeling>.

## Writing slides with R

`.qmd` files run with the R engine (`knitr`) by default, so you don't need any special header:

```yaml
---
title: Chapter 3 slides
---
```

Write R code in `r` chunks:

````markdown
```{r}
summary(cars)
```
````

**Adding R packages:** run `usethis::use_package("myCoolPackage")` in the R console — it adds the package to `DESCRIPTION`. Then install it with `pak::pak()` and use it in your chunks with `library(myCoolPackage)`. The `DESCRIPTION` file is the single source of truth for R packages in this project.

## Writing slides with Python

Python slides need two things.

**1. Tell Quarto to use the Jupyter engine.** Quarto defaults to knitr (R), so any file with Python code must start with `engine: jupyter`:

```yaml
---
engine: jupyter
title: Chapter 3 slides
---
```

Then write Python in `python` chunks:

````markdown
```{python}
import pandas as pd
```
````

The engine is chosen per file: keep R decks as they are (no `engine` line), and start every Python deck with `engine: jupyter`.

**2. Declare your Python packages in `pyproject.toml`.** Every package your slides import goes into the `dependencies` list:

```toml
dependencies = [
  "pandas",
  "matplotlib",
]
```

Version pins use the usual pip syntax, e.g. `"pandas>=2.2"`.

Then install them in your environment — once after cloning, and again every time you change `pyproject.toml`:

```sh
pip install .
```

(`pip install jupyter ipykernel` is only needed once per machine; it provides the engine itself.)

After that, previewing works exactly like R slides: `Ctrl/Cmd-Shift-K` in RStudio/Positron, or `quarto preview slides/NN.qmd` in a terminal.

> **Note — when do you need R?** R must be installed (step 3 above) to render or preview *anything* in this project, even a single pure-Python deck, because Quarto always runs the chapter-index script (`generate_chapters.R`) first. What R is *not* needed for is running your deck's code: in a file with `engine: jupyter`, all cells execute in Python — the R script only maintains the site's index.

## Code of Conduct

Please note that the bookclub-sdamodeling project is released with a [Contributor Code of Conduct](https://contributor-covenant.org/version/2/1/CODE_OF_CONDUCT.html). By contributing to this project, you agree to abide by its terms.
