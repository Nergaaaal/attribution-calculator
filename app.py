"""
Marketing Attribution Models - Streamlit Application
Demonstrates "Last Touch" vs "U-Shaped" attribution with Navigation Filter
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import random

# Page configuration
st.set_page_config(
    page_title="Marketing Attribution Models",
    page_icon="📊",
    layout="wide"
)

def generate_synthetic_data(num_users=500):
    """
    Generate synthetic user journey data with realistic scenarios.
    
    Scenario A: Digital -> Push -> TM -> Conversion (Strong TM influence)
    Scenario B: Digital -> Stories (clicked 30 sec before conversion) -> Conversion (Navigation problem)
    """
    
    channels = ["Digital Ads", "Stories", "Push", "SMS", "Telemarketing"]
    data = []
    user_id = 1
    
    # Scenario A: Digital -> Push -> Telemarketing -> Conversion (40% of conversions)
    for _ in range(100):
        base_time = datetime.now() - timedelta(days=random.randint(1, 30))
        journey = [
            {
                "User_ID": user_id,
                "Channel": "Digital Ads",
                "Interaction_Time": base_time,
                "Converted": False,
                "Conversion_Value": 0
            },
            {
                "User_ID": user_id,
                "Channel": "Push",
                "Interaction_Time": base_time + timedelta(hours=random.randint(2, 24)),
                "Converted": False,
                "Conversion_Value": 0
            },
            {
                "User_ID": user_id,
                "Channel": "Telemarketing",
                "Interaction_Time": base_time + timedelta(hours=random.randint(25, 48)),
                "Converted": False,
                "Conversion_Value": 0
            },
            {
                "User_ID": user_id,
                "Channel": "Telemarketing",  # Final conversion event
                "Interaction_Time": base_time + timedelta(hours=random.randint(48, 50)),
                "Converted": True,
                "Conversion_Value": random.randint(5000, 50000)
            }
        ]
        data.extend(journey)
        user_id += 1
    
    # Scenario B: Digital -> Stories (navigation) -> Conversion (30% of conversions)
    # Stories clicked 20-60 seconds before conversion (the "navigation problem")
    for _ in range(75):
        base_time = datetime.now() - timedelta(days=random.randint(1, 30))
        journey = [
            {
                "User_ID": user_id,
                "Channel": "Digital Ads",
                "Interaction_Time": base_time,
                "Converted": False,
                "Conversion_Value": 0
            },
            {
                "User_ID": user_id,
                "Channel": "Stories",
                "Interaction_Time": base_time + timedelta(hours=random.randint(5, 24)),
                "Converted": False,
                "Conversion_Value": 0
            },
            {
                "User_ID": user_id,
                "Channel": "Stories",  # Navigation click - very close to conversion
                "Interaction_Time": base_time + timedelta(hours=24, seconds=random.randint(-60, -20)),
                "Converted": False,
                "Conversion_Value": 0
            },
            {
                "User_ID": user_id,
                "Channel": "Stories",  # Final conversion event
                "Interaction_Time": base_time + timedelta(hours=24),
                "Converted": True,
                "Conversion_Value": random.randint(5000, 50000)
            }
        ]
        data.extend(journey)
        user_id += 1
    
    # Scenario C: SMS -> Push -> Conversion (15% of conversions)
    for _ in range(38):
        base_time = datetime.now() - timedelta(days=random.randint(1, 30))
        journey = [
            {
                "User_ID": user_id,
                "Channel": "SMS",
                "Interaction_Time": base_time,
                "Converted": False,
                "Conversion_Value": 0
            },
            {
                "User_ID": user_id,
                "Channel": "Push",
                "Interaction_Time": base_time + timedelta(hours=random.randint(12, 48)),
                "Converted": False,
                "Conversion_Value": 0
            },
            {
                "User_ID": user_id,
                "Channel": "Push",  # Final conversion event
                "Interaction_Time": base_time + timedelta(hours=random.randint(48, 72)),
                "Converted": True,
                "Conversion_Value": random.randint(5000, 50000)
            }
        ]
        data.extend(journey)
        user_id += 1
    
    # Scenario D: Digital -> Stories (legitimate) -> Telemarketing -> Conversion (15% of conversions)
    # Stories clicked hours before conversion (legitimate marketing influence)
    for _ in range(37):
        base_time = datetime.now() - timedelta(days=random.randint(1, 30))
        journey = [
            {
                "User_ID": user_id,
                "Channel": "Digital Ads",
                "Interaction_Time": base_time,
                "Converted": False,
                "Conversion_Value": 0
            },
            {
                "User_ID": user_id,
                "Channel": "Stories",
                "Interaction_Time": base_time + timedelta(hours=random.randint(6, 24)),
                "Converted": False,
                "Conversion_Value": 0
            },
            {
                "User_ID": user_id,
                "Channel": "Telemarketing",
                "Interaction_Time": base_time + timedelta(hours=random.randint(25, 48)),
                "Converted": False,
                "Conversion_Value": 0
            },
            {
                "User_ID": user_id,
                "Channel": "Telemarketing",  # Final conversion event
                "Interaction_Time": base_time + timedelta(hours=random.randint(48, 72)),
                "Converted": True,
                "Conversion_Value": random.randint(5000, 50000)
            }
        ]
        data.extend(journey)
        user_id += 1
    
    # Add some non-converting users (noise)
    for _ in range(250):
        base_time = datetime.now() - timedelta(days=random.randint(1, 30))
        num_touches = random.randint(1, 4)
        for i in range(num_touches):
            data.append({
                "User_ID": user_id,
                "Channel": random.choice(channels),
                "Interaction_Time": base_time + timedelta(hours=i * random.randint(1, 24)),
                "Converted": False,
                "Conversion_Value": 0
            })
        user_id += 1
    
    df = pd.DataFrame(data)
    df = df.sort_values(['User_ID', 'Interaction_Time']).reset_index(drop=True)
    
    return df


def apply_last_touch_attribution(df):
    """
    Simple Last Touch Attribution: Credit goes to the last channel before conversion.
    No filtering applied.
    """
    # Get only converted users
    converted_users = df[df['Converted'] == True]['User_ID'].unique()
    
    attribution_results = []
    
    for user in converted_users:
        user_journey = df[df['User_ID'] == user].sort_values('Interaction_Time')
        
        # Get the conversion event
        conversion_event = user_journey[user_journey['Converted'] == True].iloc[0]
        conversion_value = conversion_event['Conversion_Value']
        
        # Get the last touch channel (the channel of the conversion event itself)
        last_channel = conversion_event['Channel']
        
        attribution_results.append({
            'User_ID': user,
            'Channel': last_channel,
            'Attributed_Value': conversion_value
        })
    
    attribution_df = pd.DataFrame(attribution_results)
    channel_attribution = attribution_df.groupby('Channel')['Attributed_Value'].sum().reset_index()
    channel_attribution.columns = ['Channel', 'Revenue']
    
    return channel_attribution


def apply_smart_attribution(df, navigation_threshold_seconds, first_weight, last_weight, middle_weight):
    """
    Smart Attribution: U-Shaped model with Navigation Filter
    
    1. First, filter out "Stories" clicks that happened within navigation_threshold_seconds of conversion
    2. Then apply U-Shaped attribution to remaining touchpoints
    
    U-Shaped weights:
    - First Touch: first_weight (default 0.4)
    - Last Touch: last_weight (default 0.4)
    - Middle Touches: middle_weight divided equally (default 0.2 total)
    """
    converted_users = df[df['Converted'] == True]['User_ID'].unique()
    
    attribution_results = []
    
    for user in converted_users:
        user_journey = df[df['User_ID'] == user].sort_values('Interaction_Time')
        
        # Get the conversion event
        conversion_event = user_journey[user_journey['Converted'] == True].iloc[0]
        conversion_value = conversion_event['Conversion_Value']
        conversion_time = conversion_event['Interaction_Time']
        
        # Get all touchpoints before conversion (excluding the conversion event itself)
        touchpoints = user_journey[user_journey['Converted'] == False].copy()
        
        if len(touchpoints) == 0:
            # Edge case: only conversion event exists, credit it fully
            attribution_results.append({
                'User_ID': user,
                'Channel': conversion_event['Channel'],
                'Attributed_Value': conversion_value
            })
            continue
        
        # NAVIGATION FILTER: Remove "Stories" clicks within threshold
        touchpoints['Time_to_Conversion'] = (conversion_time - touchpoints['Interaction_Time']).dt.total_seconds()
        
        # Filter out Stories that are too close to conversion (navigation clicks)
        filtered_touchpoints = touchpoints[
            ~((touchpoints['Channel'] == 'Stories') & 
              (touchpoints['Time_to_Conversion'] <= navigation_threshold_seconds))
        ].copy()
        
        if len(filtered_touchpoints) == 0:
            # If all touchpoints were filtered, credit the conversion event channel
            attribution_results.append({
                'User_ID': user,
                'Channel': conversion_event['Channel'],
                'Attributed_Value': conversion_value
            })
            continue
        
        # U-SHAPED ATTRIBUTION on filtered touchpoints
        num_touchpoints = len(filtered_touchpoints)
        
        # Calculate attribution for each touchpoint
        for idx, (_, touchpoint) in enumerate(filtered_touchpoints.iterrows()):
            if num_touchpoints == 1:
                # Only one touchpoint: give it full credit
                weight = 1.0
            elif num_touchpoints == 2:
                # Two touchpoints: split between first and last
                weight = first_weight if idx == 0 else last_weight
            else:
                # Three or more touchpoints: U-shaped distribution
                if idx == 0:
                    # First touch
                    weight = first_weight
                elif idx == num_touchpoints - 1:
                    # Last touch
                    weight = last_weight
                else:
                    # Middle touches: distribute middle_weight equally
                    num_middle = num_touchpoints - 2
                    weight = middle_weight / num_middle
            
            attributed_value = conversion_value * weight
            
            attribution_results.append({
                'User_ID': user,
                'Channel': touchpoint['Channel'],
                'Attributed_Value': attributed_value
            })
    
    attribution_df = pd.DataFrame(attribution_results)
    channel_attribution = attribution_df.groupby('Channel')['Attributed_Value'].sum().reset_index()
    channel_attribution.columns = ['Channel', 'Revenue']
    
    return channel_attribution


def get_top_conversion_paths(df, top_n=5):
    """
    Get the most common conversion paths.
    """
    converted_users = df[df['Converted'] == True]['User_ID'].unique()
    
    paths = []
    for user in converted_users:
        user_journey = df[df['User_ID'] == user].sort_values('Interaction_Time')
        # Exclude the final conversion event, just get the touchpoint sequence
        touchpoints = user_journey[user_journey['Converted'] == False]['Channel'].tolist()
        path_string = ' → '.join(touchpoints) if touchpoints else 'Direct'
        paths.append(path_string)
    
    path_df = pd.DataFrame({'Path': paths})
    path_counts = path_df['Path'].value_counts().head(top_n).reset_index()
    path_counts.columns = ['Conversion Path', 'Count']
    
    return path_counts


# ============================
# STREAMLIT APP
# ============================

st.title("📊 Marketing Attribution Models for Consumer Loan")
st.markdown("### Comparing Last Touch vs Smart Attribution (U-Shaped + Navigation Filter)")

# Sidebar Controls
st.sidebar.header("⚙️ Attribution Settings")

# Navigation Threshold
nav_threshold = st.sidebar.slider(
    "Navigation Threshold (Seconds)",
    min_value=0,
    max_value=300,
    value=60,
    step=10,
    help="If a user converts less than X seconds after clicking 'Stories', treat Stories as navigation (ignore it)."
)

st.sidebar.markdown("---")
st.sidebar.subheader("U-Shaped Weights")

# U-Shaped weights
first_touch_weight = st.sidebar.slider(
    "First Touch Weight",
    min_value=0.0,
    max_value=1.0,
    value=0.4,
    step=0.05,
    help="Credit given to the first interaction in the customer journey."
)

last_touch_weight = st.sidebar.slider(
    "Last Touch Weight",
    min_value=0.0,
    max_value=1.0,
    value=0.4,
    step=0.05,
    help="Credit given to the last interaction before conversion."
)

middle_weight = st.sidebar.slider(
    "Middle Touches Weight",
    min_value=0.0,
    max_value=1.0,
    value=0.2,
    step=0.05,
    help="Total credit distributed equally among all middle interactions."
)

# Validate weights sum to 1
weights_sum = first_touch_weight + last_touch_weight + middle_weight
if abs(weights_sum - 1.0) > 0.01:
    st.sidebar.warning(f"⚠️ Weights sum to {weights_sum:.2f}, should be 1.0")

st.sidebar.markdown("---")

# Generate Data button
if st.sidebar.button("🔄 Regenerate Data"):
    st.cache_data.clear()

# Generate synthetic data
@st.cache_data
def load_data():
    return generate_synthetic_data(num_users=500)

df = load_data()

# Calculate attributions
last_touch_attribution = apply_last_touch_attribution(df)
smart_attribution = apply_smart_attribution(
    df, 
    nav_threshold, 
    first_touch_weight, 
    last_touch_weight, 
    middle_weight
)

# ============================
# VISUALIZATION 1: Model Comparison
# ============================

st.header("💰 Revenue Attribution Comparison")

# Merge attributions for comparison
comparison_df = last_touch_attribution.copy()
comparison_df.columns = ['Channel', 'Last Touch']

smart_df = smart_attribution.copy()
smart_df.columns = ['Channel', 'Smart Attribution']

merged = pd.merge(comparison_df, smart_df, on='Channel', how='outer').fillna(0)

# Melt for grouped bar chart
melted = merged.melt(id_vars='Channel', var_name='Model', value_name='Revenue')

# Create grouped bar chart
fig = px.bar(
    melted,
    x='Channel',
    y='Revenue',
    color='Model',
    barmode='group',
    title='Revenue Attribution: Last Touch vs Smart Attribution (U-Shaped + Navigation Filter)',
    labels={'Revenue': 'Attributed Revenue ($)', 'Channel': 'Marketing Channel'},
    color_discrete_map={'Last Touch': '#FF6B6B', 'Smart Attribution': '#4ECDC4'},
    height=500
)

fig.update_layout(
    xaxis_tickangle=-45,
    legend=dict(
        orientation="h",
        yanchor="bottom",
        y=1.02,
        xanchor="right",
        x=1
    )
)

st.plotly_chart(fig, use_container_width=True)

# Show the difference
st.subheader("📊 Attribution Difference (Smart - Last Touch)")

merged['Difference'] = merged['Smart Attribution'] - merged['Last Touch']
merged['Difference %'] = ((merged['Smart Attribution'] - merged['Last Touch']) / merged['Last Touch'] * 100).round(2)
merged = merged.sort_values('Difference', ascending=False)

col1, col2 = st.columns(2)

with col1:
    st.metric("Total Revenue (Last Touch)", f"${last_touch_attribution['Revenue'].sum():,.0f}")
    
with col2:
    st.metric("Total Revenue (Smart Attribution)", f"${smart_attribution['Revenue'].sum():,.0f}")

st.dataframe(
    merged.style.format({
        'Last Touch': '${:,.0f}',
        'Smart Attribution': '${:,.0f}',
        'Difference': '${:,.0f}',
        'Difference %': '{:.1f}%'
    }),
    use_container_width=True
)

# ============================
# VISUALIZATION 2: Top Conversion Paths
# ============================

st.header("🛤️ Top Conversion Paths")

top_paths = get_top_conversion_paths(df, top_n=10)

fig2 = px.bar(
    top_paths,
    x='Count',
    y='Conversion Path',
    orientation='h',
    title='Most Common Customer Journeys to Conversion',
    labels={'Count': 'Number of Conversions', 'Conversion Path': 'Customer Journey'},
    color='Count',
    color_continuous_scale='Viridis',
    height=400
)

fig2.update_layout(yaxis={'categoryorder': 'total ascending'})

st.plotly_chart(fig2, use_container_width=True)

# ============================
# DATA TABLE
# ============================

st.header("📋 Raw Data")

show_data = st.checkbox("Show raw interaction data")

if show_data:
    st.dataframe(df, use_container_width=True)
    
    st.download_button(
        label="📥 Download Data as CSV",
        data=df.to_csv(index=False).encode('utf-8'),
        file_name='attribution_data.csv',
        mime='text/csv'
    )

# ============================
# INSIGHTS
# ============================

st.header("💡 Key Insights")

stories_last_touch = last_touch_attribution[last_touch_attribution['Channel'] == 'Stories']['Revenue'].sum()
stories_smart = smart_attribution[smart_attribution['Channel'] == 'Stories']['Revenue'].sum()

tm_last_touch = last_touch_attribution[last_touch_attribution['Channel'] == 'Telemarketing']['Revenue'].sum()
tm_smart = smart_attribution[smart_attribution['Channel'] == 'Telemarketing']['Revenue'].sum()

col1, col2, col3 = st.columns(3)

with col1:
    stories_drop = ((stories_smart - stories_last_touch) / stories_last_touch * 100) if stories_last_touch > 0 else 0
    st.metric(
        "Stories Attribution Change",
        f"${stories_smart:,.0f}",
        f"{stories_drop:.1f}% vs Last Touch",
        delta_color="inverse"
    )

with col2:
    tm_increase = ((tm_smart - tm_last_touch) / tm_last_touch * 100) if tm_last_touch > 0 else 0
    st.metric(
        "Telemarketing Attribution Change",
        f"${tm_smart:,.0f}",
        f"{tm_increase:.1f}% vs Last Touch"
    )

with col3:
    total_conversions = df[df['Converted'] == True].shape[0]
    st.metric(
        "Total Conversions",
        total_conversions
    )

st.info(
    f"""
    **Navigation Threshold Impact:** With a {nav_threshold}-second threshold, "Stories" clicks 
    that occur within {nav_threshold} seconds of conversion are treated as navigation 
    (not marketing influence), and credit shifts to earlier touchpoints in the journey.
    
    **U-Shaped Model:** Gives {first_touch_weight*100:.0f}% credit to first touch, 
    {last_touch_weight*100:.0f}% to last touch, and {middle_weight*100:.0f}% distributed 
    among middle touches. This better reflects the entire customer journey.
    """
)
