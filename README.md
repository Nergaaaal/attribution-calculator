# Marketing Attribution Models - Streamlit App

## Overview
This Streamlit application demonstrates the difference between **Last Touch** and **Smart Attribution (U-Shaped + Navigation Filter)** models for a banking consumer loan product.

## Problem Statement
**Last Touch** attribution incorrectly credits "Stories" clicks when users are just navigating to find the product, not engaging with marketing content. This app compares attribution models and shows how a navigation filter can provide more accurate insights.

## Features

### 1. **Sidebar Controls**
- **Navigation Threshold**: Filter out "Stories" clicks that occur within X seconds of conversion (default: 60s)
- **U-Shaped Weights**: Customize attribution weights for first touch (40%), last touch (40%), and middle touches (20%)

### 2. **Synthetic Data Generation**
The app generates ~500 realistic user journeys with scenarios including:
- **Scenario A**: Digital → Push → Telemarketing → Conversion (Strong TM influence)
- **Scenario B**: Digital → Stories (navigation click) → Conversion (The problem case)
- **Scenario C**: SMS → Push → Conversion
- **Scenario D**: Digital → Stories (legitimate) → Telemarketing → Conversion

### 3. **Attribution Models**

#### Last Touch (Baseline)
Simply credits the last channel before conversion, regardless of timing.

#### Smart Attribution (U-Shaped + Navigation Filter)
1. **Filter**: Removes "Stories" clicks within the navigation threshold
2. **U-Shaped**: Applies weighted attribution:
   - First Touch: 40% (configurable)
   - Last Touch: 40% (configurable)
   - Middle Touches: 20% divided equally (configurable)

### 4. **Visualizations**
- **Comparison Bar Chart**: Side-by-side revenue attribution per channel
- **Attribution Difference Table**: Shows how revenue shifts between models
- **Top Conversion Paths**: Most common customer journeys leading to conversion

## Installation

```bash
# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Running the App

```bash
streamlit run app.py
```

The app will open in your browser at `http://localhost:8501`

## Usage

1. **Adjust Navigation Threshold**: Use the slider to set how many seconds define a "navigation click"
2. **Modify U-Shaped Weights**: Customize the attribution distribution
3. **Compare Models**: View the side-by-side comparison chart
4. **Analyze Paths**: See which customer journeys lead to conversions
5. **Regenerate Data**: Click the "Regenerate Data" button to create new synthetic journeys

## Key Insights

The app demonstrates that:
- **Stories** attribution drops significantly when navigation filtering is applied
- **Telemarketing** and **Digital Ads** receive more credit under the Smart Attribution model
- **U-Shaped** attribution better reflects the entire customer journey vs. just the last touch

## Technical Stack
- **Python 3.10+**
- **Streamlit**: Interactive web UI
- **Pandas**: Data manipulation
- **Plotly Express**: Interactive visualizations
- **NumPy**: Numerical operations

## Files
- `app.py`: Main Streamlit application
- `requirements.txt`: Python dependencies
- `README.md`: This file
