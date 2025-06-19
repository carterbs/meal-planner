# UI Enhancement Plan for Agent Chat Interface

## Overview
Transform the current basic chat interface into a professional, modern chat experience with improved UX/UI patterns and visual feedback for meal plan changes.

## Key Improvements

### 1. Chat Interface Overhaul
- **Replace basic List with proper chat UI**
  - Individual message bubbles with proper styling
  - User messages aligned right, agent messages aligned left
  - Avatar/icons for user vs agent identification
  - Professional spacing and typography

- **Enhanced Input Area**
  - Replace TextField with multiline TextField
  - Enter to send, Shift+Enter for new line
  - Send button integrated into input field
  - Hide input area until session starts
  - Auto-focus and auto-resize behavior

- **Scrolling Chat History**
  - Proper scrollable container with fixed height
  - Auto-scroll to bottom on new messages
  - Smooth scrolling behavior

### 2. Session Management UX
- **Conditional Input Display**
  - Only show message input after session starts
  - Better visual hierarchy for session state
  - Improved "Start New Session" button placement

- **Immediate Meal Plan Display**
  - Show meal plan immediately after session starts
  - Don't wait for resume to display initial data

### 3. Visual Change Indicators
- **Meal Plan Change Highlighting**
  - Sage green highlight animation for changed meals
  - 5-second fade-out effect using CSS transitions
  - Track meal plan changes between updates
  - Highlight specific changed entries in the table

### 4. Layout Improvements
- **Chat vs Meal Plan Separation**
  - Keep meal plan at bottom for now (easy to move later)
  - Clear visual separation between chat and meal plan
  - Responsive layout considerations
  - Better spacing and visual hierarchy

### 5. Material UI Component Upgrades
- **Enhanced Components**
  - Use Paper for message containers
  - Avatar components for user/agent identification
  - Better button styling and placement
  - Typography improvements for readability
  - Loading states with CircularProgress

## Technical Implementation

### Files to Modify
- `frontend/src/AgentPage.tsx` - Main interface overhaul
- `frontend/src/components/MealPlanDisplay.tsx` - Add change highlighting
- New CSS animations for highlighting effects

### Key Features
- Change detection logic for meal plan updates
- Keyboard event handling for Enter/Shift+Enter
- Scroll management for chat history
- State management for highlighted changes
- Responsive design considerations

### Testing Updates
- Update existing tests for new UI components
- Add tests for keyboard interactions
- Test change highlighting functionality
- Ensure accessibility compliance

## Priority Order
1. Chat interface overhaul (message bubbles, input handling)
2. Session management UX (conditional input, immediate meal plan)
3. Change highlighting system
4. Layout and visual polish
5. Testing updates

## Implementation Details

### Chat Message Components
```typescript
interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
  timestamp?: Date;
}
```

### Change Highlighting Logic
- Compare previous and current meal plans
- Identify changed/added/removed meals
- Apply CSS classes for highlighting
- Use setTimeout for fade-out effect

### Keyboard Handling
```typescript
const handleKeyPress = (event: React.KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};
```

### Scroll Management
- useRef for chat container
- useEffect to scroll on message updates
- Smooth scroll behavior

This plan will transform the basic chat interface into a professional, user-friendly experience while maintaining all existing functionality.