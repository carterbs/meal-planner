# Meal Planner UI Style Guide

## Design Philosophy
This design follows a "crunchy mom aesthetic" - natural, organic, sophisticated, and grounded. Think farmers market meets modern minimalism. The palette should evoke sage greens, warm earth tones, and natural materials without being sterile or overly clinical.

## Color Palette

### Primary Colors
- **Sage Green**: `#7fb069` - Primary brand color
- **Teal**: `#1b998b` - Secondary accent color  
- **Dusty Sage**: `#8b9a7a` - Header background start
- **Soft Olive**: `#a8b89a` - Header background end

### Neutral Colors
- **Warm Cream**: `#fefffe` - Primary background
- **Light Sage**: `#f9fdf7` - Container background
- **Off-White**: `#f4f7f0` - Body background start
- **Pale Sage**: `#eef4ea` - Body background end

### Text Colors
- **Dark Green**: `#4a5d3a` - Primary text
- **Green Gray**: `#6b7668` - Secondary text
- **Muted Green**: `#8a9584` - Tertiary text

### Component-Specific Colors
- **Day Card Background**: `linear-gradient(135deg, #fefffe 0%, #fbfef9 100%)`
- **Day Header Background**: `linear-gradient(135deg, #fafcf8 0%, #f6faf3 100%)`
- **Meal Slot Background**: `linear-gradient(135deg, #f5f9f2 0%, #eff6ec 100%)`
- **Border Color**: `#e8f0e5`

### Button Colors
- **Primary Button**: `linear-gradient(135deg, #7fb069 0%, #1b998b 100%)`
- **Primary Button Hover**: `linear-gradient(135deg, #6fa055 0%, #178a7a 100%)`
- **Secondary Button**: `linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)`
- **Swap Button**: `linear-gradient(135deg, #f0f8ed 0%, #f5faf2 100%)` with `#7fb069` text
- **Skip Button**: `linear-gradient(135deg, #fef6f0 0%, #fcf1e8 100%)` with `#e09e60` text

## Typography

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Font Sizes
- **Header Title**: `1.5rem` (24px)
- **Header Subtitle**: `0.875rem` (14px)
- **Day Header**: `1.1rem` (17.6px)
- **Meal Name**: `0.875rem` (14px)
- **Meal Effort**: `0.75rem` (12px)
- **Button Text**: `0.875rem` (14px)
- **Small Button Text**: `0.75rem` (12px)

### Font Weights
- **Header Title**: `600` (Semi-bold)
- **Day Header**: `600` (Semi-bold)
- **Meal Name**: `500` (Medium)
- **Body Text**: `500` (Medium)

## Layout & Spacing

### Container
- **Max Width**: `1400px`
- **Border Radius**: `16px`
- **Box Shadow**: `0 20px 60px rgba(0,0,0,0.08)`
- **Background**: `linear-gradient(135deg, #fefffe 0%, #f9fdf7 100%)`

### Header
- **Padding**: `24px 40px`
- **Background**: `linear-gradient(135deg, #8b9a7a 0%, #a8b89a 100%)`
- **Text Color**: `white`

### Controls Section
- **Padding**: `25px 40px`
- **Gap Between Buttons**: `12px`
- **Layout**: Flexbox with left-aligned primary actions, right-aligned secondary actions

### Calendar Grid
- **Padding**: `40px`
- **Gap Between Day Cards**: `20px`

## Components

### Day Cards
```css
background: linear-gradient(135deg, #fefffe 0%, #fbfef9 100%);
border: 1px solid #e8f0e5;
border-radius: 12px;
box-shadow: 0 4px 15px rgba(127, 176, 105, 0.08);
transition: transform 0.2s ease, box-shadow 0.2s ease;
```

**Hover State:**
```css
transform: translateY(-2px);
box-shadow: 0 8px 25px rgba(127, 176, 105, 0.15);
```

### Day Headers
```css
background: linear-gradient(135deg, #fafcf8 0%, #f6faf3 100%);
padding: 16px 20px;
border-bottom: 1px solid #e8f0e5;
color: #4a5d3a;
position: relative;
```

**Accent Stripe:**
```css
content: '';
position: absolute;
top: 0;
left: 0;
right: 0;
height: 3px;
background: linear-gradient(90deg, #7fb069 0%, #1b998b 100%);
```

### Meal Slots
```css
display: grid;
grid-template-columns: 80px 1fr auto;
gap: 16px;
align-items: center;
padding: 16px;
background: linear-gradient(135deg, #f5f9f2 0%, #eff6ec 100%);
border-radius: 8px;
border-left: 4px solid transparent;
border-image: linear-gradient(135deg, #7fb069 0%, #1b998b 100%) 1;
transition: all 0.2s ease;
```

**Hover State:**
```css
background: linear-gradient(135deg, #f2f7ef 0%, #eef4eb 100%);
transform: translateX(2px);
```

**Skipped State:**
```css
opacity: 0.6;
```

### Buttons

#### Primary Button
```css
background: linear-gradient(135deg, #7fb069 0%, #1b998b 100%);
color: white;
border: none;
border-radius: 6px;
padding: 10px 20px;
font-weight: 500;
font-size: 0.875rem;
box-shadow: 0 4px 15px rgba(127, 176, 105, 0.3);
transition: all 0.2s ease;
```

#### Secondary Button
```css
background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
color: #6b7280;
border: 1px solid #d1d5db;
border-radius: 6px;
padding: 10px 20px;
font-weight: 500;
font-size: 0.875rem;
transition: all 0.2s ease;
```

#### Small Action Buttons
```css
padding: 6px 12px;
border: 1px solid #e8f0e5;
border-radius: 6px;
font-size: 0.75rem;
font-weight: 500;
background: linear-gradient(135deg, #fefffe 0%, #fafcf8 100%);
color: #6b7668;
transition: all 0.2s ease;
```

**Button Hover Effects:**
```css
transform: translateY(-1px) or translateY(-2px);
box-shadow: 0 2px 8px or 0 6px 20px (varies by button type);
```

### Shopping List
```css
margin-top: 30px;
padding: 25px;
background: linear-gradient(135deg, #f6faf3 0%, #f2f7ef 100%);
border-radius: 12px;
border: 1px solid #e8f0e5;
box-shadow: 0 4px 15px rgba(127, 176, 105, 0.05);
```

## Responsive Design

### Mobile (max-width: 768px)
- Meal slots change to single column layout: `grid-template-columns: 1fr`
- Center align meal actions
- Reduce padding on containers

## Animation & Interactions

### Micro-interactions
- **Hover Translations**: Subtle `translateY(-1px)` or `translateY(-2px)` on hover
- **Transition Duration**: `0.2s ease` for all hover effects
- **Box Shadows**: Increase shadow intensity and spread on hover
- **Color Transitions**: Smooth gradient shifts on hover states

### Visual Feedback
- All interactive elements should have clear hover states
- Buttons should feel responsive with subtle lift animations
- Cards should respond to hover with gentle elevation
- Meal slots should slide slightly on hover (`translateX(2px)`)

## Implementation Notes

### Key Design Principles
1. **Subtle Gradients**: All backgrounds use gentle gradients, never flat colors
2. **Consistent Border Radius**: 6px for small elements, 8px for medium, 12px+ for large
3. **Layered Shadows**: Use colored shadows (`rgba(127, 176, 105, ...)`) instead of pure black
4. **Natural Color Progression**: Colors should feel like they exist in nature
5. **Micro-animations**: Every interactive element should respond to user interaction

### Avoid
- Harsh, saturated colors
- Flat, single-color backgrounds  
- Sharp, angular designs
- Overly clinical or sterile appearances
- Pure black or white (always add a hint of natural color)

### Color Temperature
- Lean towards warm undertones
- Add subtle green tints to grays and whites
- Avoid cool blues except for the specific teal accent
- Think "morning sunlight filtering through leaves"

This design should feel like planning meals while sitting at a reclaimed wood table in a bright, airy kitchen filled with plants and natural light.