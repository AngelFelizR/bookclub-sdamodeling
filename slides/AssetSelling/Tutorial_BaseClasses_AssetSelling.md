# Understanding `BaseClasses` and `AssetSelling`

## A step-by-step guide to sequential decision analytics and Python classes

### What this tutorial is for

By the end of this tutorial, you should be able to:

1. Explain the difference between a **model** and a **policy**.
2. Read Python classes, methods, inheritance, and the `@abstractmethod` decorator without treating them as mysterious syntax.
3. Trace one complete time step through `SDPModel` and `AssetSellingModel`.
4. Explain why a few notebook lines can simulate and evaluate a complete sequential decision problem.
5. Design and test your own model and policy without relying blindly on defaults.

This tutorial assumes that you are comfortable writing Python **functions**, but that classes, methods, and decorators are new to you.

---

## Quick start (optional, but recommended)

If you want to run the code before reading the theory, here is a minimal working example. Run it from the `AssetSelling` directory (the `sys.path.append("../")` lines assume this working directory, matching the notebook).

```python
import sys
sys.path.append("../")  # so BaseClasses can be found when run from AssetSelling/

import AssetSellingModel as asm
import AssetSellingPolicies as asp

# 1. Create a model: initial price 20, horizon of 30 periods, fixed seed.
model = asm.AssetSellingModel(S0={"price": 20}, T=30, seed=42)

# 2. Create a policy attached to that model.
policy = asp.HighLowPolicy(model=model, theta_low=10, theta_high=30)

# 3. Simulate 100 episodes and print the estimated expected sale proceeds.
mean_performance = policy.run_policy(n_iterations=100)
print(f"Estimated expected sale proceeds: {mean_performance:.2f}")

# 4. Inspect the results in more detail.
print(policy.results.head(10))                  # row-by-row log of one or more episodes
print(policy.performance)                       # terminal accumulated contribution per episode
print(policy.performance["C_t sum"].std())      # variability across episodes
```

You do not need to understand every line yet; the goal is just to confirm the environment works and see what the objects look like before diving into the theory. If imports fail, check that you are running from the `AssetSelling` folder and that `numpy`, `pandas`, and (only for the historical section later) `yfinance` are installed.

---

## How to use this tutorial

You do not need to absorb everything in one sitting.

### First pass: understand the essential workflow

Read:

1. Sections 1–3: the problem and its architecture.
2. Sections 4–7 (optional): a Python-classes primer. **Skip this part if you are already comfortable with classes, methods, inheritance, and decorators**; jump straight to Section 8.
3. Sections 8–11: the base model, the asset-selling implementation, and one complete trace.

### Second pass: understand evaluation and experimentation

Read:

1. Sections 12–14: simulation output, randomness, and parameter search.
2. Section 15: the historical-data variant.

### Third pass: build something yourself

Use:

1. Section 16 as a design checklist.
2. Section 17 for guided exercises.
3. Sections 18–19 as **reference material** (a debugging guide and a glossary)—consult them as needed rather than reading front-to-back.
4. Section 20 as a short wrap-up.

> **Learning rule:** after reading about a method, find it in the source file and explain what inputs it receives, what it changes, and what it returns.

---

## Contents

1. [The problem in plain English](#1-the-problem-in-plain-english)
2. [The five building blocks of a sequential decision problem](#2-the-five-building-blocks-of-a-sequential-decision-problem)
3. [The software architecture](#3-the-software-architecture)
4. [From functions to classes](#4-from-functions-to-classes)
5. [Attributes, methods, and `self`](#5-attributes-methods-and-self)
6. [Inheritance and `super()`](#6-inheritance-and-super)
7. [Abstract classes and the `@abstractmethod` decorator](#7-abstract-classes-and-the-abstractmethod-decorator)
8. [Inside `SDPModel`](#8-inside-sdpmodel)
9. [Inside `AssetSellingModel`](#9-inside-assetsellingmodel)
10. [Inside the policies](#10-inside-the-policies)
11. [One complete simulation, step by step](#11-one-complete-simulation-step-by-step)
12. [Understanding `results` and `performance`](#12-understanding-results-and-performance)
13. [Randomness, seeds, and Monte Carlo error](#13-randomness-seeds-and-monte-carlo-error)
14. [What `grid_search` does—and does not do](#14-what-grid_search-doesand-does-not-do)
15. [The historical-data model](#15-the-historical-data-model)
16. [A checklist for designing your own SDA problem](#16-a-checklist-for-designing-your-own-sda-problem)
17. [Guided exercises](#17-guided-exercises)
18. [Common errors and debugging guide](#18-common-errors-and-debugging-guide)
19. [Python and SDA glossary](#19-python-and-sda-glossary)
20. [Final mental model](#20-final-mental-model)

---

# Part I — Understand the problem before the code

# 1. The problem in plain English

You own one asset. At each time period, you observe its current price and choose between two actions:

- **Hold** the asset.
- **Sell** the asset at the current observed price.

If you sell, the episode ends because there is nothing left to sell. If you still own the asset at the end of the time horizon, the policies included in this repository force a sale in the last decision period.

There are two separate questions.

## 1.1 The model's question

> Given the current state and an action, what happens next?

The model describes the world:

- how prices change;
- what random information arrives;
- how the state is updated;
- what reward is received;
- when the episode ends.

## 1.2 The policy's question

> Given the current state, what action should I choose?

For example:

> Sell if the price is below 10 or above 30; otherwise, hold.

The policy does not generate prices or update the state. It only chooses an action.

## 1.3 Why this distinction matters

You can test the same policy under different price processes, or compare different policies under the same price process, because the model and the policy are separate objects.

This separation is one of the most important design ideas in the repository.

---

# 2. The five building blocks of a sequential decision problem

At each time period, we work with five core objects.

| Building block | Symbol | Meaning in asset selling |
|---|---|---|
| State | $S_t$ | Current price, price regime, smoothed price, and whether we still own the asset. |
| Decision | $x_t$ | Sell or hold. |
| Exogenous information | $W_{t+1}$ | New price and new price regime. |
| Transition | $S^M$ | Rules used to construct the next state. |
| Contribution | $C_t$ | Cash received from selling, or zero. |

A policy maps the current state to a decision:

$$
x_t=\pi(S_t)
$$

The transition function produces the next state:

$$
S_{t+1}=S^M(S_t,x_t,W_{t+1})
$$

The contribution for the period can be written generically as:

$$
C_t=C(S_t,x_t,W_{t+1})
$$

## 2.1 The exact timing convention

The repository implements the following order:

$$
S_t
\longrightarrow x_t=\pi(S_t)
\longrightarrow W_{t+1}
\longrightarrow C_t
\longrightarrow S_{t+1}
$$

For asset selling, this means:

1. Observe today's state and price.
2. Decide whether to sell (the policy chooses the action).
3. Generate tomorrow's exogenous information: the next price and price regime.
4. Calculate today's contribution. If we sell, we receive **today's** price (from $S_t$); otherwise the contribution is zero.
5. Update the remaining state variables (ownership, smoothed price) and construct tomorrow's state $S_{t+1}$.
6. Advance the time index.

The timing is not a cosmetic detail. If the code used tomorrow's price to reward a sale chosen today, it would represent a different problem.

## 2.2 What it means to evaluate a policy

For one episode, the total contribution is:

$$
F^\pi=\sum_t C_t
$$

Because prices are random, we usually want the expected performance:

$$
\mathbb{E}\left[F^\pi\right]
$$

The repository estimates this expectation by simulating $N$ episodes and taking their average:

$$
\widehat{\mathbb{E}}[F^\pi]
=
\frac{1}{N}\sum_{n=1}^{N}F^{\pi,n}
$$

This is Monte Carlo evaluation. It is not an analytical proof that the policy is optimal.

### Checkpoint 1

1. Which object chooses an action: the model or the policy?
2. Which object generates the next random price?
3. Why is the timing of $W_{t+1}$ important?

<details>
<summary>Answers</summary>

1. The policy chooses the action.
2. The model generates it through `exog_info_fn`.
3. Because decisions must use currently available information, and the reward must use the price associated with the intended timing convention.

</details>

---

# 3. The software architecture

These are the relevant files:

| File | Responsibility |
|---|---|
| `BaseClasses/SDPModel.py` | Generic machinery for sequential decision models. |
| `BaseClasses/SDPPolicy.py` | Generic machinery for running and evaluating policies. |
| `BaseClasses/Util.py` | Utilities such as grid search. |
| `AssetSelling/AssetSellingModel.py` | Rules specific to asset selling. |
| `AssetSelling/AssetSellingPolicies.py` | Specific decision rules. |
| `AssetSelling/AssetSelling.ipynb` | Experiments and visualizations. |

The inheritance structure is:

```text
SDPModel
   └── AssetSellingModel
          └── AssetSellingModelHistorical

SDPPolicy
   ├── SellLowPolicy
   ├── HighLowPolicy
   └── TrackPolicy
```

The notebook is short because it sits on top of all this machinery:

```text
Notebook
   ├── creates a model
   ├── creates a policy connected to that model
   └── calls the inherited simulation engine
```

---

# Part II — Python classes from the ground up

> **This part is optional reference material.** If you already understand classes, methods, `self`, inheritance, `super()`, and abstract methods, feel free to skip ahead to [Section 8: Inside `SDPModel`](#8-inside-sdpmodel). The next four sections exist only to make the source code readable for readers who are new to object-oriented Python.

# 4. From functions to classes

## 4.1 What a function does

A function groups behavior:

```python
def smoothed_price(old_price, new_price, alpha):
    return (1 - alpha) * old_price + alpha * new_price
```

You pass data to it explicitly:

```python
result = smoothed_price(20, 22, 0.7)
```

A function is ideal when you mainly need to transform inputs into outputs.

## 4.2 Why introduce a class?

A simulation needs to remember information between calls:

- the current state;
- the current time;
- the accumulated objective;
- model parameters;
- the random-number generator.

A class bundles this information together with the functions that operate on it.

The data stored in the object are called **attributes**. Functions defined inside the class are called **methods**.

A simplified example is:

```python
class Counter:
    def __init__(self, start):
        self.value = start

    def increment(self):
        self.value += 1
        return self.value
```

Do not worry if the syntax still looks strange. We will unpack every part.

## 4.3 A class is a blueprint; an instance is an object

The class definition describes how to build objects:

```python
class Counter:
    ...
```

This line creates one instance:

```python
counter_a = Counter(start=0)
```

This line creates another, independent instance:

```python
counter_b = Counter(start=10)
```

They belong to the same class but store different data:

```python
print(counter_a.value)  # 0
print(counter_b.value)  # 10
```

Calling a method on one instance does not change the other:

```python
counter_a.increment()

print(counter_a.value)  # 1
print(counter_b.value)  # 10
```

## 4.4 The constructor: `__init__`

Python automatically calls `__init__` when you create an instance:

```python
counter_a = Counter(start=0)
```

The constructor receives `start=0` and executes:

```python
self.value = start
```

This creates an attribute named `value` and stores `0` in the new object.

A constructor usually answers:

> What information must every new object contain before I can use it?

For `AssetSellingModel`, that includes the state, time horizon, model parameters, and random-number generator.

---

# 5. Attributes, methods, and `self`

## 5.1 Attributes

Attributes are values attached to an object. You access them with dot notation:

```python
model.state
model.t
model.T
model.alpha
```

For example:

```python
self.T = T
```

means “store the constructor argument `T` in this object's `T` attribute”.

## 5.2 Methods

A method is defined like a function, but inside a class:

```python
class Counter:
    def __init__(self, start):
        self.value = start

    def increment(self):
        self.value += 1
        return self.value
```

You call it on an instance:

```python
counter_a.increment()
```

You do not write:

```python
increment(counter_a)
```

The method already knows which object it belongs to.

## 5.3 What `self` means

`self` refers to the particular instance on which the method was called.

Conceptually:

```python
counter_a.increment()
```

is similar to:

```python
Counter.increment(counter_a)
```

Python supplies `counter_a` as the first argument automatically. That is why instance methods declare `self` as their first parameter.

When `increment` executes:

```python
self.value += 1
```

it changes `counter_a.value`, not some global variable and not `counter_b.value`.

## 5.4 A method can read and modify attributes

Consider:

```python
def reset(self):
    self.state = self.initial_state
    self.objective = 0.0
    self.t = self.t0
```

This method:

- reads `initial_state` and `t0` from the current object;
- replaces its current `state`;
- resets its accumulated `objective`;
- resets its current time `t`.

The object therefore maintains its own simulation memory.

## 5.5 A method can return something without modifying the object

For example:

```python
def get_decision(self, state, t, T):
    ...
    return {"sell": 0, "hold": 1}
```

The immediate purpose of this method is to return a decision. The model, not the policy, applies that decision to the state.

### Checkpoint 2

Given:

```python
model = AssetSellingModel(S0={"price": 20}, T=30)
```

answer:

1. Is `model` a class or an instance?
2. Is `state` an attribute or a method?
3. What does `self` refer to while `model.reset()` is running?

<details>
<summary>Answers</summary>

1. `model` is an instance of `AssetSellingModel`.
2. `state` is an attribute.
3. `self` refers to `model`.

</details>

---

# 6. Inheritance and `super()`

## 6.1 The problem inheritance solves

Many sequential decision models need the same generic operations:

- build a state;
- build a decision;
- reset an episode;
- advance time;
- execute one simulation step.

Copying those methods into every model would create duplication. Instead, the repository places them in `SDPModel`.

A specific model then declares:

```python
class AssetSellingModel(SDPModel):
```

This means:

> `AssetSellingModel` inherits the generic behavior of `SDPModel` and adds or replaces problem-specific behavior.

## 6.2 Inherited methods are available on the child class

`AssetSellingModel.py` does not define `step`, `build_state`, or `build_decision`.

Nevertheless, this works:

```python
model.step(decision)
```

because `model` inherits those methods from `SDPModel`.

## 6.3 Overriding a method

A child class can replace an inherited method by defining a method with the same name.

`SDPModel` defines a generic `is_finished` based on time. `AssetSellingModel` defines its own `is_finished` so that an episode can also end after a sale.

This is called **overriding**.

## 6.4 `super()` calls the parent implementation

Sometimes the child does not want to replace all parent behavior. It wants to reuse it and add something.

In the constructor:

```python
super().__init__(state_names, decision_names, S0, t0, T, seed)
```

means:

> Run the `SDPModel` constructor first, using these arguments.

The sequence is:

1. `AssetSellingModel.__init__` starts.
2. It defines state and decision names.
3. `super().__init__(...)` builds the generic components.
4. Execution returns to `AssetSellingModel.__init__`.
5. The child adds `alpha`, `var`, `bias_df`, `upstep`, and `downstep`.

Another example is:

```python
return super().is_finished() or not hold_asset
```

This means:

- ask the parent whether time is over;
- also check whether the asset is gone;
- finish if either condition is true.

## 6.5 Inheritance is not the same as composition

Inheritance describes an **is-a** relationship:

```text
AssetSellingModel is a specialized SDPModel.
```

Composition describes a **has-a** relationship:

```text
A policy has a model.
```

The policy stores its model here:

```python
self.model = model
```

The policy is not a specialized model. It uses a model to run simulations.

---

# 7. Abstract classes and the `@abstractmethod` decorator

## 7.1 What is a decorator?

A decorator is syntax placed above a function or class definition to modify or annotate its behavior.

The general form is:

```python
@some_decorator
def some_function(...):
    ...
```

You do not need to know how to build decorators to use this repository. You only need to understand what the specific decorator used here means.

## 7.2 What `@abstractmethod` means here

`SDPModel` inherits from `ABC`, which stands for *Abstract Base Class*:

```python
from abc import ABC, abstractmethod

class SDPModel(ABC):
```

It then declares:

```python
@abstractmethod
def exog_info_fn(self, decision):
    pass
```

The decorator marks this method as a **required interface**, not as a generic implementation.

It says:

> Every concrete sequential decision model must provide its own version of this method.

The three required methods are:

```python
exog_info_fn(...)
transition_fn(...)
objective_fn(...)
```

The base class cannot implement them generically because they depend on the application.

## 7.3 Why the method body is only `pass`

`pass` means “do nothing”.

The body is not intended to generate real information. The important part is the method's name and signature. A child class supplies the real behavior.

## 7.4 What happens if a child forgets one?

A concrete child that does not implement all abstract methods remains abstract. Python will normally raise a `TypeError` when you try to instantiate it.

This is useful: Python detects an incomplete model early instead of letting the simulation fail later in a less obvious place.

## 7.5 How the base class can call a method it did not implement

The generic `step` method contains:

```python
exog_info = self.exog_info_fn(decision)
```

If `self` is an `AssetSellingModel`, Python finds and runs `AssetSellingModel.exog_info_fn`.

If `self` is an `AssetSellingModelHistorical`, Python runs the historical version instead.

The caller stays the same while the concrete behavior changes. This is **polymorphism**.

### Checkpoint 3

1. Does `@abstractmethod` generate random prices by itself?
2. Why can `SDPModel.step` call `self.exog_info_fn` even though the base implementation is only `pass`?
3. What is the purpose of `super().__init__(...)`?

<details>
<summary>Answers</summary>

1. No. It marks a method that a concrete child must implement.
2. Because the actual instance is a concrete child, and Python resolves the method on that child class.
3. It initializes the generic components supplied by the parent class before the child adds its own components.

</details>

---

# Part III — Read the source code with confidence

# 8. Inside `SDPModel`

Open `BaseClasses/SDPModel.py` while reading this section.

## 8.1 What the constructor receives

```python
def __init__(
    self,
    state_names,
    decision_names,
    S0,
    t0=0,
    T=1,
    seed=42,
):
```

| Argument | Meaning |
|---|---|
| `state_names` | Names of all state variables. |
| `decision_names` | Names of all decision variables. |
| `S0` | Dictionary containing initial state values. |
| `t0` | Initial time. |
| `T` | Time horizon. |
| `seed` | Seed for pseudo-random number generation. |

## 8.2 Creating `State` and `Decision` types

The constructor executes:

```python
self.State = namedtuple("State", state_names)
self.Decision = namedtuple("Decision", decision_names)
```

A `namedtuple` is a lightweight Python type whose values can be accessed by field name.

For this application, a state looks conceptually like:

```python
State(
    price=20,
    bias="Neutral",
    price_smoothed=20,
    resource=1,
)
```

You can therefore write:

```python
state.price
state.resource
decision.sell
```

instead of relying on numerical positions.

A `namedtuple` is immutable. You do not update it with:

```python
state.price = 22  # Not allowed
```

Instead, the model builds a new state object after every transition.

## 8.3 Initial state versus current state

The constructor creates:

```python
self.initial_state = self.build_state(S0)
self.state = self.build_state(S0)
```

They serve different purposes:

- `initial_state` preserves the episode's starting point;
- `state` changes during the simulation.

It also initializes:

```python
self.objective = 0.0
self.t = t0
self.T = T
self.episode_counter = 0
```

The `objective` attribute accumulates contributions. The historical model uses `episode_counter` to select a historical path.

## 8.4 The model's random-number generator

The constructor creates:

```python
self.prng = np.random.RandomState(seed)
```

`prng` stands for *pseudo-random number generator*.

The model uses this object to generate random values. Every random draw advances its internal state.

## 8.5 Building structured states and decisions

The method:

```python
def build_state(self, info):
    return self.State(*[info[k] for k in self.state_names])
```

looks up every required state name in the dictionary `info` and constructs a `State`.

Similarly:

```python
def build_decision(self, info):
    return self.Decision(*[info[k] for k in self.decision_names])
```

constructs a `Decision`.

For this repository:

```python
decision_names = ["sell"]
```

Therefore:

```python
{"sell": 1, "hold": 0}
```

becomes conceptually:

```python
Decision(sell=1)
```

The `hold` entry is ignored because it is not listed in `decision_names`.

> **Debugging rule:** if `build_state` raises `KeyError`, check whether all required state variables were supplied by the exogenous-information and transition methods.

## 8.6 Resetting an episode

```python
def reset(self, reset_prng=False):
    self.state = self.initial_state
    self.objective = 0.0
    self.t = self.t0
```

If `reset_prng=True`, it also creates a fresh random generator from the original seed.

The standard `run_policy` method uses `reset_prng=False`, so successive episodes continue the random sequence rather than repeating it.

## 8.7 The `step` method

This is the most important method in the base model.

### Step A: generate exogenous information

```python
exog_info = self.exog_info_fn(decision)
```

For stochastic asset selling, this returns a new price and regime.

### Step B: accumulate the contribution

```python
self.objective += self.objective_fn(decision, exog_info)
```

At this point, `self.state` is still $S_t$. The reward can therefore use the current price and current asset ownership.

### Step C: calculate transition variables

```python
exog_info.update(self.transition_fn(decision, exog_info))
```

`transition_fn` returns updated values for `resource` and `price_smoothed`.

The dictionary method `update` merges those values into `exog_info`, which already contains `price` and `bias`.

### Step D: construct the next state

```python
self.state = self.build_state(exog_info)
```

The merged dictionary now contains all four state variables.

### Step E: advance time and return the state

```python
self.update_t()
return self.state
```

The entire method can be summarized as:

```text
Current state + decision
          ↓
Generate exogenous information
          ↓
Calculate and accumulate contribution
          ↓
Merge exogenous and transition information
          ↓
Build next state
          ↓
Advance time
```

## 8.8 Generic termination

The parent class finishes when:

$$
t\geq T
$$

A child can override this rule, as `AssetSellingModel` does.

---

# 9. Inside `AssetSellingModel`

Open `AssetSelling/AssetSellingModel.py`.

## 9.1 State variables

The model declares:

```python
state_names = ["price", "bias", "price_smoothed", "resource"]
```

Mathematically:

$$
S_t=
(\text{price}_t,\text{bias}_t,
\text{price\_smoothed}_t,\text{resource}_t)
$$

| Variable | Meaning |
|---|---|
| `price` | Currently observed price. |
| `bias` | Current regime: `"Up"`, `"Neutral"`, or `"Down"`. |
| `price_smoothed` | Exponentially smoothed price. |
| `resource` | `1` if the asset is still owned; otherwise `0`. |

The smoothed price is needed by `TrackPolicy`. It does not affect the reward or the random price process.

## 9.2 Initial-state defaults

The notebook supplies only:

```python
S0={"price": 20}
```

The constructor fills in missing values:

```python
bias = "Neutral"
price_smoothed = S0["price"]
resource = 1
```

The initial state is therefore:

$$
S_0=(20,\text{Neutral},20,1)
$$

These defaults are modeling choices, not universal rules.

> **Gotcha:** the constructor writes these defaults directly into the `S0` dictionary you passed in (it does not make a copy). If you reuse the same `S0` dictionary to create another model, it will already contain the defaults from the first model.

## 9.3 Decision variable

```python
decision_names = ["sell"]
```

The model uses:

- `sell=1` to sell;
- `sell=0` to hold.

The additional `hold` value returned by policies is redundant and is discarded when the structured decision is built.

## 9.4 Model parameters

| Parameter | Default | Interpretation in the code |
|---|---:|---|
| `alpha` | `0.7` | Weight assigned to the newest price in smoothing. |
| `var` | `2` | Standard deviation passed to `np.random.normal`, despite its name. |
| `upstep` | `1` | Mean price change in the `"Up"` regime. |
| `downstep` | `-1` | Mean price change in the `"Down"` regime. |
| `bias_df` | Built-in table | Regime-transition probabilities. |
| `seed` | `42` | Initial random seed. |

## 9.5 Exogenous information

The method starts with:

```python
biasprob = self.bias_df[self.state.bias]
```

The default transition probabilities are:

| Current regime | P(Up) | P(Neutral) | P(Down) |
|---|---:|---:|---:|
| Up | 0.9 | 0.1 | 0.0 |
| Neutral | 0.2 | 0.6 | 0.2 |
| Down | 0.0 | 0.1 | 0.9 |

Then:

```python
coin = self.prng.uniform()
```

draws a number used to select the next regime.

For example, when the current regime is `"Up"`:

- `coin < 0.9` selects `"Up"`;
- `0.9 <= coin < 1.0` selects `"Neutral"`;
- direct movement to `"Down"` has probability zero.

The selected regime determines the mean price change:

$$
\mu_{t+1}=
\begin{cases}
\text{upstep}, & \text{Up},\\
0, & \text{Neutral},\\
\text{downstep}, & \text{Down}.
\end{cases}
$$

The code then draws:

```python
price_delta = self.prng.normal(bias, self.var)
```

Thus:

$$
\Delta p_{t+1}\sim N(\mu_{t+1},\text{var}^2)
$$

> **Important:** NumPy's second argument is the standard deviation. With `var=2`, the standard deviation is 2 and the mathematical variance is 4.

The new price is truncated at zero:

$$
p_{t+1}=\max(0,p_t+\Delta p_{t+1})
$$

Finally, the method returns:

```python
{"price": new_price, "bias": new_bias}
```

## 9.6 State transition

Asset ownership is updated by:

```python
new_resource = 0 if decision.sell == 1 else self.state.resource
```

The smoothed price is updated by:

```python
new_price_smoothed = (
    (1 - alpha) * self.state.price_smoothed
    + alpha * exog_info["price"]
)
```

In mathematical notation:

$$
\bar p_{t+1}=(1-\alpha)\bar p_t+\alpha p_{t+1}
$$

Small values of $\alpha$ make the smoothed price respond slowly. Values close to 1 make it respond quickly.

The method returns:

```python
{
    "resource": new_resource,
    "price_smoothed": new_price_smoothed,
}
```

## 9.7 Contribution

The reward code is:

```python
sell_size = 1 if decision.sell == 1 and self.state.resource != 0 else 0
return self.state.price * sell_size
```

Therefore:

$$
C_t=
\begin{cases}
p_t, & \text{if we sell while owning the asset},\\
0, & \text{otherwise}.
\end{cases}
$$

Notice that the reward uses `self.state.price`, not `exog_info["price"]`. The sale receives the price observed when the decision was made.

The model includes no transaction cost, holding cost, discounting, or nonlinear utility.

## 9.8 Termination

The child overrides `is_finished`:

```python
hold_asset = self.state.resource
return super().is_finished() or not hold_asset
```

The episode ends when either:

- $t\geq T$; or
- `resource == 0`.

After a sale, no further decisions are simulated.

### Checkpoint 4

1. Which two methods jointly provide all values needed by `build_state`?
2. Why does the reward use the current state price?
3. What are the two ways an episode can end?

<details>
<summary>Answers</summary>

1. `exog_info_fn` supplies `price` and `bias`; `transition_fn` supplies `resource` and `price_smoothed`.
2. Because the decision to sell is made at the currently observed price.
3. The time horizon is reached or the asset is sold.

</details>

---

# 10. Inside the policies

Open `AssetSelling/AssetSellingPolicies.py`.

Every policy inherits from `SDPPolicy` and implements:

```python
get_decision(self, state, t, T)
```

## 10.1 `SellLowPolicy`

It sells when:

```python
state.price < theta_low
```

Its tunable parameter is `theta_low`.

## 10.2 `HighLowPolicy`

It sells when:

```python
state.price < theta_low or state.price > theta_high
```

Otherwise, it holds.

Its tunable parameters are `theta_low` and `theta_high`.

## 10.3 `TrackPolicy`

It sells when the current price is sufficiently far from the smoothed price:

```python
state.price >= state.price_smoothed + theta
```

or:

```python
state.price <= state.price_smoothed - theta
```

Equivalently:

$$
|p_t-\bar p_t|\geq\theta
$$

Its tunable parameter is `theta`.

## 10.4 Forced terminal sale

All three policies include:

```python
if t == T - 1:
    new_decision = {"sell": 1, "hold": 0}
```

With `T=30`, decisions occur at `t=0` through `t=29`. The forced sale occurs at `t=29`.

This rule belongs to the policies, not to `SDPModel`. A new custom policy must include equivalent logic if you want to guarantee a terminal sale.

## 10.5 Assumptions and comparison details worth knowing

A few details are easy to miss when reading or extending these policies:

- **Terminal-sale timing assumes integer steps starting at `t0 = 0`.** The check `t == T - 1` only fires at exactly that integer. If you use a non-integer horizon, a non-zero `t0`, or a different time convention, this rule may never trigger.
- **`HighLowPolicy` uses strict inequalities** (`<` and `>`), while `TrackPolicy` uses inclusive ones (`>=` and `<=`). A price exactly equal to a threshold behaves differently in the two policies.
- **Model parameters are not validated by the code.** For example, `alpha` is intended to lie in `[0, 1]`, `var` should be non-negative, and the rows of `bias_df` should sum to 1. Passing invalid values will not raise an error but will produce nonsensical dynamics.
- **The policies assume the asset starts owned** (`resource == 1`). They do not check this; a model initialized without the asset would still receive "sell" decisions at the terminal step.

---

# 11. One complete simulation, step by step

This section connects `SDPPolicy.run_policy`, `SDPModel.step`, and the notebook.

## 11.1 The notebook creates a model

```python
model = asm.AssetSellingModel(S0={"price": 20}, T=30)
```

This creates an object with:

- initial price 20;
- initial regime `"Neutral"`;
- initial smoothed price 20;
- one asset;
- time `t=0`;
- horizon `T=30`;
- an accumulated objective of zero.

## 11.2 The notebook creates a policy

```python
high_low_policy = asp.HighLowPolicy(
    model=model,
    theta_low=10,
    theta_high=30,
)
```

The policy stores:

```python
self.model = model
self.theta_low = 10
self.theta_high = 30
```

## 11.3 The notebook runs 100 episodes

```python
high_low_policy.run_policy(n_iterations=100)
```

For each episode, `run_policy` performs this loop:

```text
Copy the model
Reset state, time, and objective

While the episode is not finished:
    Read the current state
    Ask the policy for a decision
    Build a structured Decision
    Log the current state and decision
    Call model.step(decision)

Log the terminal state
```

After all episodes, it builds result tables and returns the average terminal objective.

## 11.4 A numerical trace of the mechanics

The numbers below are **illustrative**, not promised output from a particular seed. Their purpose is to make the order of operations explicit.

Start with:

$$
S_0=(20,\text{Neutral},20,1)
$$

The current price 20 is between 10 and 30, so `HighLowPolicy` chooses hold:

$$
x_0=(\text{sell}=0)
$$

Suppose the exogenous method produces:

```python
{"price": 21.4, "bias": "Up"}
```

Because we did not sell, the contribution is zero. The smoothed price becomes:

$$
\bar p_1=0.3(20)+0.7(21.4)=20.98
$$

The resource remains 1, so:

$$
S_1=(21.4,\text{Up},20.98,1)
$$

At `t=1`, the price is still between the thresholds, so the policy holds again.

Now suppose the next exogenous information is:

```python
{"price": 31.2, "bias": "Up"}
```

The new smoothed price is:

$$
\bar p_2=0.3(20.98)+0.7(31.2)=28.134
$$

The next state is:

$$
S_2=(31.2,\text{Up},28.134,1)
$$

At `t=2`, the policy observes 31.2, which is above `theta_high=30`. It chooses sell.

The contribution uses the **current** price:

$$
C_2=31.2
$$

The accumulated objective becomes 31.2. The transition sets `resource=0`.

`step` still generates exogenous information and constructs the next state before returning, but the next `is_finished` check ends the episode because the asset is gone.

The key lesson is:

> The decision and reward use $S_t$; the exogenous information and transition then produce $S_{t+1}$.

## 11.5 What the returned number means

With 100 episodes, the returned value is:

$$
\frac{1}{100}\sum_{n=1}^{100}F^{\pi,n}
$$

It is an estimate of expected performance under the specified model and policy. It is neither a guaranteed amount of sale proceeds nor a proof of optimality.

### Checkpoint 5

In the trace above:

1. Why is the reward at the sale equal to 31.2 rather than the next exogenous price?
2. Why does the episode end after `resource` becomes zero?
3. Which method updates the smoothed price?

<details>
<summary>Answers</summary>

1. Because `objective_fn` runs before the state update and uses `self.state.price`.
2. Because `AssetSellingModel.is_finished` adds asset ownership to the termination condition.
3. `AssetSellingModel.transition_fn`.

</details>

---

# Part IV — Evaluate experiments critically

# 12. Understanding `results` and `performance`

After running a policy, inspect:

```python
high_low_policy.results
```

Important columns include:

| Column | Meaning |
|---|---|
| `N` | Episode number. |
| `t` | Time index. |
| `C_t sum` | Accumulated objective before the logged decision is executed. |
| `price` | Current price. |
| `bias` | Current regime. |
| `price_smoothed` | Current smoothed price. |
| `resource` | Current asset ownership. |
| `sell` | Logged decision. |
| `t_end` | Last logged time for the episode. |
| `C_t` | Contribution associated with a transition. |

A conceptual episode might look like this (using the illustrative prices from Section 11):

| N | t | price | resource | sell | C_t sum | C_t |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 20 | 1 | 0 | 0 | 0 |
| 0 | 1 | 21.4 | 1 | 0 | 0 | 0 |
| 0 | 2 | 31.2 | 1 | 1 | 0 | 31.2 |
| 0 | 3 | 30.7 | 0 | — | 31.2 | NaN |

Two different columns represent the same revenue in two ways:

- **`C_t sum`**: the accumulated total **before** the decision on that row is executed. The sale revenue of 31.2 therefore only shows up in `C_t sum` on the *following* row (the terminal row `t=3`).
- **`C_t`**: the contribution earned during the transition **out of** that row's state. It is computed after the run by differencing consecutive `C_t sum` values, so the 31.2 appears on the `t=2` row itself—the row where the decision `sell=1` was made. The final terminal row has no next row, so its `C_t` is `NaN`.

In short: `C_t` tells you which period earned the money; `C_t sum` tells you the running total before each decision is applied.

The attribute:

```python
high_low_policy.performance
```

contains the terminal accumulated contribution for each episode. The scalar returned by `run_policy` is its mean.

You can inspect variability with:

```python
high_low_policy.performance["C_t sum"].std()
```

Do not judge a policy solely by its average if tail losses or high variability matter for your application. (Note: in this model there are no purchase or transaction costs, so these values are gross **sale proceeds**, not net profit.)

---

# 13. Randomness, seeds, and Monte Carlo error

## 13.1 Why repeated runs differ

Running this cell twice usually produces different averages:

```python
high_low_policy.run_policy(n_iterations=100)
```

Each run continues consuming random numbers. It does not automatically restore the original seed.

Different averages across repeated simulation batches are a form of Monte Carlo sampling variability.

## 13.2 Why more episodes usually stabilize the average

If episode performance has finite variance, the standard error of the sample mean behaves approximately as:

$$
SE(\bar F)=\frac{\sigma}{\sqrt{N}}
$$

Multiplying the number of episodes by 100 reduces the standard error by approximately a factor of 10, not 100.

More simulations reduce uncertainty about the **estimated mean**. They do not remove randomness from individual price paths.

## 13.3 Reproducibility requires more than seeing `seed=42`

The random stream also depends on:

- how many random values have already been consumed;
- the order of experiments;
- episode lengths;
- which random methods were called.

If two policies sell at different times, their episodes may consume different numbers of random values.

For careful comparisons, use fresh model instances, deliberate seed management, and enough episodes to assess stability.

## 13.4 Quantifying simulation uncertainty in practice

Episode-to-episode standard deviation (`performance["C_t sum"].std()`) measures **variability of outcomes**. To measure **uncertainty of the estimated mean**, use the standard error:

```python
import numpy as np

perf = high_low_policy.performance["C_t sum"]
n = len(perf)
mean = perf.mean()
std = perf.std()              # sample std (ddof=1)
se = std / np.sqrt(n)         # standard error of the mean

print(f"Mean: {mean:.2f}, SE: {se:.2f}, 95% CI approx: ({mean - 1.96*se:.2f}, {mean + 1.96*se:.2f})")
```

Use this when comparing two policies or judging whether a new parameter is genuinely better: if the confidence intervals overlap substantially, the difference may be simulation noise rather than a real improvement. Standard deviation answers "how spread out are individual episodes?"; standard error answers "how confident should I be in the average I am reporting?"

---

# 14. What `grid_search` does—and does not do

The notebook defines:

```python
grid = {
    "theta_low": np.linspace(10, 20, 11),
    "theta_high": np.linspace(20, 30, 11),
}
```

Then it calls:

```python
result = util.grid_search(
    grid,
    high_low_policy,
    n_iterations=10,
    ordered=True,
)
```

For each parameter combination, the utility:

1. Creates a deep copy of the policy.
2. Assigns the candidate parameter values using `setattr`.
3. Runs the policy.
4. Records its average performance.
5. Tracks the highest average found.

With `ordered=True`, combinations satisfying `theta_low >= theta_high` are skipped.

The result contains:

```python
result["best_parameters"]
result["best_performance"]
result["all_runs"]
```

> **Important limitation:** inside `grid_search`, `best_performance` starts at `0.0`, and a candidate only replaces it when its average is strictly greater. If **every** candidate has negative average performance (which is common in the historical-data setting), `best_parameters` stays `None` and no least-bad candidate is reported. Keep this in mind before trusting `best_parameters` blindly.

## 14.1 Why `deepcopy` matters

The utility uses `deepcopy(policy)` so each candidate begins with the same copied random-generator state. This is intended to make comparisons less dependent on different random streams.

However, this does **not** guarantee identical complete price paths for every candidate. Candidates that make different decisions (for example, selling at different times) can consume different numbers of random values, so their paths diverge even though they started from the same random state. The common-random-numbers effect holds only until the policies' behavior causes the streams to split.

A shallow `copy`, used inside `run_policy`, does not recursively duplicate every contained object.

## 14.2 Why 10 episodes can produce a misleading winner

The best average from a small simulation sample may reflect luck rather than a genuinely superior parameter combination.

A safer workflow is:

1. Use a coarse grid for exploration.
2. Select several promising candidates.
3. Reevaluate them with many more episodes.
4. Compare variability as well as means.
5. Where possible, validate on independent scenarios.

## 14.3 What grid search does not prove

Grid search does not prove:

- global optimality over all possible parameters;
- optimality over all possible policy classes;
- good performance outside the assumed price model;
- that the winning average is statistically distinguishable from nearby candidates.

And as noted at the start of this section, the `best_performance = 0.0` initialization means all-negative candidate sets are mishandled.

---

# 15. The historical-data model

The class declaration is:

```python
class AssetSellingModelHistorical(AssetSellingModel):
```

It inherits most behavior and replaces only the parts related to episode data and exogenous prices.

## 15.1 How the historical data must be prepared

The notebook builds `hist_data` with a helper like `get_historical_monthly_paths`, which does the following for each calendar month:

1. Download daily closing prices for one stock.
2. Take the **first** closing price of the month as a baseline.
3. Store each day's price as a deviation from that baseline: `price = Close - Close_Month_Start`.
4. Assign an episode number `N` (0, 1, 2, ...) identifying the month.

So the `hist_data` DataFrame needs at least two columns:

| Column | Meaning |
|---|---|
| `N` | Episode (month) index, integers starting at 0. |
| `price` | Price deviation from that month's first closing price. |

Because prices are stored as deviations, the model's initial price is `0.0` (not 20 like the stochastic model). A price of `+15` means "15 currency units above where the stock started the month"; `-10` means 10 below. This is why grid-search thresholds later use negative values like `theta_low=-10`.

## 15.2 Selecting one historical episode

Its `reset` method selects data where:

```python
self.hist_data["N"] == self.episode_counter
```

It extracts the prices, removes the initial value (the month's baseline), and sets `T` according to the remaining path length.

Each episode represents one historical month. Episodes are replayed **sequentially** by `episode_counter` (0, 1, 2, ...), not randomly sampled.

> **Important indexing detail:** after removing the month's first price, `T` equals the number of remaining prices. The forced terminal sale (`t == T - 1`) therefore triggers on the **second-to-last** observation of the month. The very last observation is still consumed by `exog_info_fn` during that final transition (to build the next state), but it is never used as the sale price. If you need the sale to occur exactly on the month's last observed price, you would have to adjust this logic yourself.

## 15.3 Replacing random prices with observed prices

Instead of drawing a normal price change, it uses:

```python
def exog_info_fn(self, decision):
    return {
        "price": self.episode_data.pop(0),
        "bias": "Neutral",
    }
```

`pop(0)` returns and removes the next available price.

Everything else continues to work:

- policies;
- reward;
- ownership transition;
- smoothing;
- logging;
- grid search.

This is a practical benefit of inheritance and polymorphism: the simulation engine remains unchanged while the source of exogenous information changes.

With 120 historical months, 120 iterations evaluate those historical episodes. They do not generate 120 new artificial months.

## 15.4 Tune and validate on different months

The notebook tunes thresholds on the same 120 months it later reports performance for. This **overfits**: the chosen thresholds are optimized for those exact historical paths, so the reported "best performance" is optimistic and will likely degrade on new data.

A safer workflow:

1. Split the months chronologically (for example, months 0–95 for tuning, months 96–119 for validation).
2. Run grid search using only the tuning months.
3. Re-evaluate the winning parameters on the held-out validation months.
4. Report validation performance, not tuning performance, as the realistic estimate.

Note also that `best_performance = 0.0` inside `grid_search` (see Section 14) means that if every candidate produces negative average deviations (plausible for some stocks), `best_parameters` will remain `None`.

---

# Part V — Build your own understanding through practice

# 16. A checklist for designing your own SDA problem

Answer these questions before writing a class.

## 16.1 State

> What must I remember at the start of a period to choose an action and continue the dynamics?

A variable belongs in the state if it is needed by:

- the policy;
- the transition;
- the exogenous process;
- the contribution;
- the termination condition.

Do not add variables merely because they are available.

## 16.2 Decision

> What does the decision maker actually control?

Do not include random outcomes or consequences of the action.

## 16.3 Exogenous information

> What new information arrives that the decision maker does not directly control?

Be explicit about its probability model or data source.

## 16.4 Transition

> How does every state variable obtain its next value?

For this asset model:

- `price` and `bias` come from `exog_info_fn`;
- `resource` and `price_smoothed` come from `transition_fn`.

Your implementation must provide every name required by `build_state`.

## 16.5 Contribution

> What is gained or lost during each period, and using information from which time index?

Check whether the contribution depends on the pre-decision state, the action, the new information, or a combination.

## 16.6 Termination

> Does the episode end only at the time horizon, or can an event end it earlier?

## 16.7 Policy

> How is the available state transformed into an action?

A policy should return an action, not directly alter the model's state.

## 16.8 Evaluation

> What performance measure matters, and how precise does its estimate need to be?

Choose the number of episodes based on variability, computational cost, and the differences you need to detect—not simply because a notebook uses 100.

## 16.9 Minimal model template

```python
class MyModel(SDPModel):
    def __init__(self, S0, T, seed=42):
        state_names = [...]
        decision_names = [...]

        super().__init__(
            state_names=state_names,
            decision_names=decision_names,
            S0=S0,
            T=T,
            seed=seed,
        )

    def exog_info_fn(self, decision):
        # Return new exogenous information.
        return {...}

    def transition_fn(self, decision, exog_info):
        # Return state variables updated by the transition.
        return {...}

    def objective_fn(self, decision, exog_info):
        # Return one period's contribution, not the cumulative total.
        return ...
```

Start with one episode and manually verify a few transitions before running large experiments.

---

# 17. Guided exercises

All exercises below assume you have already run the imports from the Quick Start (or from the notebook):

```python
import sys
sys.path.append("../")
import AssetSellingModel as asm
import AssetSellingPolicies as asp
import BaseClasses.Util as util
import numpy as np
```

## Exercise 1: Read one episode before optimizing anything

Create a fresh model and policy:

```python
model = asm.AssetSellingModel(S0={"price": 20}, T=30, seed=42)

policy = asp.HighLowPolicy(
    model=model,
    theta_low=10,
    theta_high=30,
)

policy.run_policy(n_iterations=1)
print(policy.results)
```

For the row where `sell == 1`, answer:

1. What was the current price?
2. Why did the policy sell?
3. What was the resource before the decision?
4. Where does the sale revenue appear in `C_t sum`?
5. Why are there no further decision rows?

Only continue when you can answer all five from the table.

<details>
<summary>Hints</summary>

1. Look at the `price` column on the row where `sell == 1`.
2. Compare that price with `theta_low` and `theta_high`.
3. Look at the `resource` column on the same row.
4. Compare `C_t sum` on the `sell == 1` row with the terminal row after it.
5. Check what happens to `resource` after the sale, and recall the `is_finished` rule.

</details>

## Exercise 2: Predict before changing volatility

Create two models, one with low volatility and one with high volatility:

```python
model_low_vol = asm.AssetSellingModel(
    S0={"price": 20}, T=30, var=1, seed=42
)

model_high_vol = asm.AssetSellingModel(
    S0={"price": 20}, T=30, var=4, seed=42
)
```

Note that `var` is passed as a **standard deviation** to `np.random.normal`, so `var=1` means a standard deviation of 1, and `var=4` means a standard deviation of 4.

Before running them, write down:

- whether you expect more threshold crossings;
- whether you expect average performance to rise or fall;
- whether you expect more variable episode outcomes.

Then evaluate the same policy class and parameters (but a **separate** policy object attached to each model) and compare your prediction with the evidence:

```python
policy_low = asp.HighLowPolicy(model=model_low_vol, theta_low=10, theta_high=30)
policy_high = asp.HighLowPolicy(model=model_high_vol, theta_low=10, theta_high=30)

policy_low.run_policy(n_iterations=1000)
policy_high.run_policy(n_iterations=1000)

print("Low vol:", policy_low.performance["C_t sum"].mean())
print("High vol:", policy_high.performance["C_t sum"].mean())
print("Low vol std:", policy_low.performance["C_t sum"].std())
print("High vol std:", policy_high.performance["C_t sum"].std())
```

<details>
<summary>Answers</summary>

Higher volatility generally increases the chance of crossing either threshold sooner and increases the spread of outcomes. Whether the average rises or falls depends on the thresholds and the price process; the key point is that variance, not just the mean, changes noticeably.

</details>

## Exercise 3: Understand `alpha`

`alpha` is a **model** parameter (it controls how the smoothed price is computed), so you need a fresh model for each value:

```python
for alpha in [0.1, 0.5, 0.9]:
    model = asm.AssetSellingModel(S0={"price": 20}, T=30, alpha=alpha, seed=42)
    policy = asp.TrackPolicy(model=model, theta=5)
    policy.run_policy(n_iterations=1000)
    print(f"alpha={alpha}: mean={policy.performance['C_t sum'].mean():.2f}")
```

For each case, explain:

1. How quickly does the smoothed price react?
2. How does that affect $|p_t-\bar p_t|$?
3. Why might the same `theta` produce different behavior?

This exercise demonstrates that model parameters and policy parameters interact.

<details>
<summary>Answers</summary>

1. Small `alpha` (e.g., 0.1) makes the smoothed price react slowly; large `alpha` (e.g., 0.9) makes it react almost immediately to the newest price.
2. A slow-moving smoothed price means $|p_t-\bar p_t|$ can stay elevated for many periods after a jump; a fast-moving one closes the gap quickly.
3. The same `theta` can therefore trigger very different numbers of sales depending on `alpha`, because the reference value $\bar p_t$ itself changes at a different rate.

</details>

## Exercise 4: Test the time horizon

Compare `T=5`, `T=30`, and `T=100` while holding other modeling choices fixed:

```python
for T in [5, 30, 100]:
    model = asm.AssetSellingModel(S0={"price": 20}, T=T, seed=42)
    policy = asp.HighLowPolicy(model=model, theta_low=10, theta_high=30)
    policy.run_policy(n_iterations=1000)
    print(f"T={T}: mean={policy.performance['C_t sum'].mean():.2f}")
```

Do not assume that more time must improve performance. Waiting creates opportunities, but it also creates exposure to unfavorable prices.

<details>
<summary>Answers</summary>

There is no universally correct answer; the effect depends on the price process and thresholds. Longer horizons give more chances for a favorable threshold crossing but also more chances for the forced terminal sale to happen at a bad price. Compare the means and the standard deviations, not just the means.

</details>

## Exercise 5: Separate tuning from evaluation

1. Run grid search with 10 episodes per candidate.
2. Save the best parameters.
3. Reevaluate them with at least 1,000 episodes.
4. Compare the new estimate with `best_performance`.
5. Repeat the evaluation to examine stability.

```python
model = asm.AssetSellingModel(S0={"price": 20}, T=30, seed=42)
policy = asp.HighLowPolicy(model=model, theta_low=10, theta_high=30)

grid = {
    "theta_low": np.linspace(10, 20, 11),
    "theta_high": np.linspace(20, 30, 11),
}
result = util.grid_search(grid, policy, n_iterations=10, ordered=True)
print("Tuning best:", result["best_parameters"], result["best_performance"])

best = result["best_parameters"]
policy2 = asp.HighLowPolicy(model=model, theta_low=best["theta_low"], theta_high=best["theta_high"])
policy2.run_policy(n_iterations=1000)
print("Reevaluation:", policy2.performance["C_t sum"].mean())
```

Explain any difference in terms of Monte Carlo error and selection among noisy candidates.

<details>
<summary>Answers</summary>

The reevaluation estimate will usually be somewhat lower than the tuning `best_performance`, because the winning candidate was partly selected for having benefited from a lucky random draw in the small tuning sample. This is the same phenomenon described in Section 14.2.

</details>

## Exercise 6: Write a custom policy

```python
from BaseClasses.SDPPolicy import SDPPolicy

class MyPolicy(SDPPolicy):
    def __init__(self, model, threshold):
        super().__init__(model, policy_name="MyPolicy")
        self.threshold = threshold

    def get_decision(self, state, t, T):
        if state.price >= self.threshold:
            return {"sell": 1}

        if t == T - 1:
            return {"sell": 1}

        return {"sell": 0}
```

Before running it, identify:

- the parent class;
- the attributes created by the constructor;
- the role of `super()`;
- the decision rule;
- the terminal-sale rule.

Then run it:

```python
model = asm.AssetSellingModel(S0={"price": 20}, T=30, seed=42)
my_policy = MyPolicy(model=model, threshold=25)
my_policy.run_policy(n_iterations=1000)
print(my_policy.performance["C_t sum"].mean())
```

<details>
<summary>Answers</summary>

- Parent class: `SDPPolicy`.
- Attributes: `model`, `policy_name`, `threshold`.
- `super().__init__` calls `SDPPolicy.__init__` to store the model and initialize `results`/`performance`.
- Decision rule: sell whenever the current price is at or above `threshold`.
- Terminal-sale rule: also sell at `t == T - 1` regardless of price, so the asset is never left unsold at the horizon.

</details>

## Exercise 7: Deliberately create and diagnose an error

In a temporary copy of a custom model—not the repository source—omit one required state variable from the combined exogenous and transition information.

Predict the error before running. Then explain why `build_state` cannot construct the next state.

The goal is to learn the data contract between methods, not to break the working project.

<details>
<summary>Hints</summary>

`build_state` iterates over `self.state_names` and looks up each name in the merged dictionary produced by `exog_info_fn` and `transition_fn`. If a name is missing from that dictionary, Python raises a `KeyError` naming the missing state variable.

</details>

---

# 18. Common errors and debugging guide

| Problem or misconception | What to check |
|---|---|
| “`run_policy` optimizes my policy.” | It only simulates and evaluates. Parameter search is separate. |
| “Grid search proves global optimality.” | It compares only tested candidates using noisy estimates. |
| `TypeError` when creating a model | Check whether all abstract methods are implemented. |
| `KeyError` in `build_state` | Check that all `state_names` are supplied by exogenous information and transition output. |
| `KeyError` in `build_decision` | Check that the policy returns every name in `decision_names`. |
| Unexpected zero terminal reward | Check whether the custom policy ever sells, including at `T - 1`. |
| Confusion about sale price | Remember that `objective_fn` uses the pre-transition state price. |
| Different averages after repeated runs | The random generator continues from its current state. |
| Unstable winning parameters | Increase evaluation episodes and inspect variability. |
| Misinterpretation of `var` | It is passed as a standard deviation, not a variance. |
| Unexpected episode ending | Check both `t >= T` and `resource == 0`. |
| Confusion about `copy` | Shallow copy and deep copy treat contained mutable objects differently. |

## A practical debugging sequence

When a new model fails:

1. Print `state_names` and `decision_names`.
2. Print the initial state.
3. Call `get_decision` once and inspect its dictionary.
4. Call `build_decision` and inspect the structured decision.
5. Call `exog_info_fn` and inspect its keys.
6. Call `transition_fn` and inspect its keys.
7. Confirm that their combined keys cover every state variable.
8. Check the contribution and next state manually.

This is more informative than immediately running thousands of episodes.

---

# 19. Python and SDA glossary

## Python terms

**Class**  
A blueprint for creating objects.

**Instance**  
A concrete object created from a class.

**Attribute**  
Data stored on an object, such as `model.state`.

**Method**  
A function defined by a class and normally called on an instance.

**`self`**  
The instance on which an instance method is operating.

**Constructor / `__init__`**  
The method that initializes a new instance.

**Inheritance**  
A mechanism through which a child class reuses and specializes parent-class behavior.

**Overriding**  
Defining a child method with the same name as a parent method to replace its behavior.

**`super()`**  
A way to access parent-class implementations.

**Decorator**  
Syntax that modifies or annotates a function or class definition.

**`@abstractmethod`**  
A decorator marking a method that a concrete child must implement.

**Polymorphism**  
Using the same method interface while different concrete classes provide different behavior.

**Composition**  
Building an object that contains another object, such as a policy containing a model.

**`namedtuple`**  
A lightweight immutable structure with named fields.

## SDA terms

**State**  
Information needed to make decisions and continue the dynamics.

**Decision**  
An action controlled by the decision maker.

**Exogenous information**  
New information not directly controlled by the decision maker.

**Transition**  
The rule for constructing the next state.

**Contribution**  
The reward or cost associated with one period.

**Policy**  
A rule that maps available information to an action.

**Episode**  
One simulated trajectory from an initial state to termination.

**Monte Carlo evaluation**  
Estimating expected performance by averaging simulated episodes.

---

# 20. Final mental model

The repository separates four levels:

```text
Generic SDA model machinery     → SDPModel
Generic simulation engine       → SDPPolicy.run_policy
Asset-selling world             → AssetSellingModel
Specific decision rules         → HighLowPolicy, TrackPolicy, etc.
```

When you run:

```python
policy.run_policy(n_iterations=100)
```

you activate this collaboration:

```text
Policy observes state
        ↓
Policy returns decision
        ↓
Model generates exogenous information
        ↓
Model calculates contribution
        ↓
Model constructs next state
        ↓
Policy observes again
```

The final mapping to remember is:

| SDA concept | Repository implementation |
|---|---|
| State $S_t$ | `State`, built by `build_state` |
| Decision $x_t$ | `Decision`, built by `build_decision` |
| Exogenous information $W_{t+1}$ | `exog_info_fn` |
| Transition to $S_{t+1}$ | `transition_fn` + `build_state` |
| Contribution $C_t$ | `objective_fn` |
| Policy $\pi$ | `get_decision` |
| Episode | The `while` loop in `run_policy` |
| Monte Carlo estimate | Average returned by `run_policy` |
| Parameter search | `grid_search` |

If you can identify these components in a new problem, you no longer need to memorize the notebook. You can reason about what the code should contain, where each rule belongs, and how to test whether the implementation matches your intended model.

The best next step is simple: **run one episode, inspect one sale, and explain every value involved in that transition.** Once you can do that confidently, parameter tuning and larger experiments will rest on a solid foundation.
