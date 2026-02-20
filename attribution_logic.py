def deduplicate_consecutive(journey):
    """
    1. Sequential Deduplication (Base Filter)
    Collapses consecutive identical channels in the user journey into a single touchpoint.
    Example: ['Push', 'Push', 'Banner', 'Push'] -> ['Push', 'Banner', 'Push']
    """
    if not journey:
        return []
    
    deduplicated = [journey[0]]
    for channel in journey[1:]:
        if channel != deduplicated[-1]:
            deduplicated.append(channel)
            
    return deduplicated

def calculate_u_shape(journey):
    """
    2. U-Shape (Position Based) Logic
    - 40% First touch
    - 40% Last touch
    - 20% distributed evenly *only among the unique channels* in the middle.
    Returns a dictionary of {channel: weight_assigned} for the given journey.
    """
    weights = {}
    n = len(journey)
    
    if n == 0:
        return weights
        
    if n == 1:
        # If only 1 touchpoint, give it 100%
        weights[journey[0]] = 1.0
        return weights
        
    if n == 2:
        # If exactly 2, split 50/50 (40+40 normalized)
        weights[journey[0]] = weights.get(journey[0], 0) + 0.5
        weights[journey[-1]] = weights.get(journey[-1], 0) + 0.5
        return weights
        
    # 3 or more touchpoints
    first = journey[0]
    last = journey[-1]
    middle_touches = journey[1:-1]
    
    # 40% First, 40% Last
    weights[first] = weights.get(first, 0) + 0.4
    weights[last] = weights.get(last, 0) + 0.4
    
    # Process Middle: distribute 20% only among unique channels
    unique_middle = list(set(middle_touches))
    if unique_middle:
        middle_share = 0.2 / len(unique_middle)
        for ch in unique_middle:
            weights[ch] = weights.get(ch, 0) + middle_share
            
    return weights

def calculate_weighted_score(journey, channel_scores):
    """
    3. Weighted Score Logic
    - If a channel appears multiple times, apply its score only once.
    - Calculate percentage share = Channel Score / Total Unique Score
    Returns a dictionary of {channel: share_assigned}.
    
    Args:
        journey: list of channels
        channel_scores: dict mapping channel name to its configured score 
                        (e.g. {'Push': 5, 'Banner': 3, 'SMS': 1})
    """
    weights = {}
    # Get unique channels in the entire journey
    unique_channels = list(set(journey))
    
    if not unique_channels:
        return weights
        
    # Calculate total score from unique channels only
    total_score = sum(channel_scores.get(ch, 0) for ch in unique_channels)
    
    if total_score > 0:
        for ch in unique_channels:
            score = channel_scores.get(ch, 0)
            weights[ch] = score / total_score
            
    return weights

def process_all_journeys(df, channel_scores):
    """
    Example runner function mimicking how you'd process a DataFrame of journeys.
    Assumes `df` has a column 'Journey_List' and 'Revenue' (or similar base value).
    """
    u_shape_results = {}
    weighted_results = {}
    
    for _, row in df.iterrows():
        raw_journey = row['Journey_List']
        revenue = row.get('Revenue', 1) # Assuming 1 conversion or actual revenue amount
        
        # 1. Base Filter
        dedup_journey = deduplicate_consecutive(raw_journey)
        
        if not dedup_journey:
            continue
            
        # 2. U-Shape Distribution
        u_shape_weights = calculate_u_shape(dedup_journey)
        for ch, weight in u_shape_weights.items():
            u_shape_results[ch] = u_shape_results.get(ch, 0) + (revenue * weight)
            
        # 3. Weighted Score Distribution
        weighted_scores = calculate_weighted_score(dedup_journey, channel_scores)
        for ch, weight in weighted_scores.items():
            weighted_results[ch] = weighted_results.get(ch, 0) + (revenue * weight)
            
    return u_shape_results, weighted_results
