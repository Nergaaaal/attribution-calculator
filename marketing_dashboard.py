import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import time

# ---------------------------------------------------------
# 1. Synthetic Data Generation (Cached)
# ---------------------------------------------------------
@st.cache_data
def generate_synthetic_data(n_rows=8000):
    """
    Generates synthetic user journey data for a Banking Loan product.
    Simulates a bias where 'Stories' often appears as a last touch 
    very close to conversion (navigation clicks).
    """
    
    channels = ['Digital Ads', 'Push', 'Telemarketing', 'SMS', 'Direct', 'Stories']
    
    data = []
    
    # Probabilities for channel occurrence
    # Stories has high prob to be last touch in bias scenario
    
    for _ in range(n_rows):
        # Random journey length 2-6
        journey_len = np.random.randint(2, 7)
        
        # Base journey
        journey = np.random.choice(channels, size=journey_len, replace=True).tolist()
        
        # Simulating Bias: 
        # 30% of conversions have "Stories" as the very last touch
        # and it happened very quickly (navigation click)
        is_navigation_click = np.random.random() < 0.30
        
        time_to_convert = 0
        
        if is_navigation_click:
            # Force last touch to be Stories
            journey[-1] = 'Stories'
            # Short time to convert (e.g., 5-55 seconds)
            time_to_convert = np.random.randint(5, 59)
        else:
            # Normal conversions (e.g., 2 minutes to 24 hours)
            time_to_convert = np.random.randint(120, 86400)
            
            # Ensure last touch isn't Stories to emphasize the contrast 
            # (or leave it random, but let's make it less likely for contrast)
            if journey[-1] == 'Stories' and np.random.random() < 0.5:
                 journey[-1] = np.random.choice(['Digital Ads', 'Telemarketing'])

        # Loan Amount ($1k - $50k)
        loan_amount = np.random.randint(1000, 50001)
        
        data.append({
            'Journey_List': journey,
            'Time_To_Convert_Seconds': time_to_convert,
            'Loan_Amount': loan_amount
        })
        
    return pd.DataFrame(data)

# ---------------------------------------------------------
# 2. Attribution Logic
# ---------------------------------------------------------
def calculate_attribution(df, model_type, navigation_threshold=60, u_shape_weights=(0.4, 0.4, 0.2)):
    """
    Calculates attributed sales volume based on the selected model.
    """
    # Initialize attributions
    channel_revenue = {}
    
    w_first, w_last, w_middle = u_shape_weights
    
    for _, row in df.iterrows():
        journey = row['Journey_List']
        revenue = row['Loan_Amount']
        time_seconds = row['Time_To_Convert_Seconds']
        
        # --- PRE-PROCESSING (SMART MODEL ONLY) ---
        if model_type == 'Smart Model':
            # Check for "Navigation Click" bias
            last_touch = journey[-1]
            if last_touch == 'Stories' and time_seconds < navigation_threshold:
                # Ignore the last touch (Stories)
                # Slicing excluding the last element
                journey = journey[:-1]
                
            # If journey becomes empty (rare, but possible if length was 1), skip or attribute to Direct
            if not journey:
                continue

        # --- ATTRIBUTION MODELS ---
        
        if model_type == 'Legacy Last Touch':
            # Simple Last Touch
            winner = journey[-1]
            channel_revenue[winner] = channel_revenue.get(winner, 0) + revenue
            
        elif model_type == 'Smart Model':
            # U-Shape (Position Based) on the *cleaned* journey
            n = len(journey)
            
            if n == 1:
                # 100% to single touch
                touch = journey[0]
                channel_revenue[touch] = channel_revenue.get(touch, 0) + revenue
            elif n == 2:
                # Split 50/50 (or follow U-Shape logic: first/last)
                # Let's use proportional U-Shape logic: First (0.5), Last (0.5) normalizing 0.4/0.4
                # Or simplier: 50% each
                for touch in journey:
                    channel_revenue[touch] = channel_revenue.get(touch, 0) + (revenue * 0.5)
            else:
                # 3+ touchpoints
                # First
                channel_revenue[journey[0]] = channel_revenue.get(journey[0], 0) + (revenue * w_first)
                # Last
                channel_revenue[journey[-1]] = channel_revenue.get(journey[-1], 0) + (revenue * w_last)
                # Middle (split remaining w_middle among n-2 items)
                middle_share = (revenue * w_middle) / (n - 2)
                for touch in journey[1:-1]:
                    channel_revenue[touch] = channel_revenue.get(touch, 0) + middle_share

    return channel_revenue

# ---------------------------------------------------------
# 3. Main Render Function
# ---------------------------------------------------------
def render_attribution_page():
    st.title("🏦 Marketing Attribution Dashboard")
    st.markdown("Comparing **Legacy Last Touch** vs. **Smart Model** (Navigation Bias Correction)")
    
    # --- Sidebar Controls ---
    st.sidebar.header("⚙️ Smart Model Settings")
    
    nav_threshold = st.sidebar.slider(
        "Navigation Threshold (Stories)", 
        min_value=0, 
        max_value=300, 
        value=60, 
        step=10,
        help="If 'Stories' is the last touch and occurs < X seconds before conversion, it is ignored."
    )
    
    st.sidebar.subheader("U-Shape Weights")
    w_first = st.sidebar.slider("First Touch Weight", 0.0, 1.0, 0.4, 0.1)
    w_last = st.sidebar.slider("Last Touch Weight", 0.0, 1.0, 0.4, 0.1)
    w_middle = round(1.0 - w_first - w_last, 2)
    
    if w_middle < 0:
        st.sidebar.error("Weights exceed 1.0! Please adjust.")
        return
    else:
        st.sidebar.info(f"Middle Weight (Calculated): {w_middle}")
    
    # --- Data Generation ---
    with st.spinner("Generating synthetic banking journeys..."):
        df = generate_synthetic_data()
        
    st.write(f"**Data Profile:** {len(df):,} User Journeys generated.")
    
    with st.expander("Peek at Raw Data"):
        st.dataframe(df.head())

    # --- Calculations ---
    legacy_results = calculate_attribution(df, 'Legacy Last Touch')
    smart_results = calculate_attribution(
        df, 
        'Smart Model', 
        navigation_threshold=nav_threshold, 
        u_shape_weights=(w_first, w_last, w_middle)
    )
    
    # --- Processing for Chart ---
    # Convert dicts to DF
    df_legacy = pd.DataFrame(list(legacy_results.items()), columns=['Channel', 'Volume'])
    df_legacy['Model'] = 'Legacy Last Touch'
    
    df_smart = pd.DataFrame(list(smart_results.items()), columns=['Channel', 'Volume'])
    df_smart['Model'] = 'Smart Model'
    
    df_combined = pd.concat([df_legacy, df_smart])
    
    # Sort by total volume for better visualization
    total_vol = df_combined.groupby('Channel')['Volume'].sum().sort_values(ascending=False).index
    
    # --- Visualization ---
    st.subheader("📊 Attribution Model Comparison")
    
    fig = px.bar(
        df_combined,
        x='Channel',
        y='Volume',
        color='Model',
        barmode='group',
        category_orders={'Channel': total_vol},
        title="Attributed Sales Volume: Legacy vs Smart Logic",
        color_discrete_map={'Legacy Last Touch': '#EF553B', 'Smart Model': '#636EFA'}
    )
    fig.update_layout(yaxis_title="Total Loan Value ($)")
    st.plotly_chart(fig, use_container_width=True)
    
    # --- Metric Deltas ---
    st.subheader("📉 Impact Analysis")
    
    col1, col2 = st.columns(2)
    
    # Calculate Deltas
    stories_legacy = legacy_results.get('Stories', 0)
    stories_smart = smart_results.get('Stories', 0)
    stories_delta = stories_smart - stories_legacy
    
    digital_legacy = legacy_results.get('Digital Ads', 0)
    digital_smart = smart_results.get('Digital Ads', 0)
    digital_delta = digital_smart - digital_legacy
    
    with col1:
        st.metric(
            label="Stories Attribution",
            value=f"${stories_smart:,.0f}",
            delta=f"${stories_delta:,.0f}",
            delta_color="inverse" # Negative is red (Good, because we reduced false attribution)
        )
        st.caption("Lower is better (Removing 'Navigation Clicks')")
        
    with col2:
        st.metric(
            label="Digital Ads Attribution",
            value=f"${digital_smart:,.0f}",
            delta=f"${digital_delta:,.0f}",
            delta_color="normal" # Positive is green
        )
        st.caption("Real value uncovered underneath")

# Entry point for testing the module directly
if __name__ == "__main__":
    st.set_page_config(page_title="Marketing Attribution", layout="wide")
    render_attribution_page()
