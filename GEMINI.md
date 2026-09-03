# My Bike Project Context

## Project Overview
A motorcycle maintenance and fuel tracking application built with React, Vite, and TypeScript.

## Design System: Jelly Glass
- **Theme**: Dark-first (Void Black) with translucent glass elements.
- **Components**: Use `var(--glass-bg)` and `backdrop-blur` for cards and navigation.
- **Accents**: Phosphor Violet (`--purple`) for active states and primary actions.

## Navigation Architecture
- **Consolidated Navigation**: All navigation is handled via the **Top Navigation Bar (`NavBar` in App.tsx)**.
- **Links**: Garage, Expenses, and Settings.
- **Mobile Behavior**: Links collapse to icons (🏍️, 💰, ⚙️) on small screens.
- **Quick Actions**: The (+) button in the TopNav provides access to Service and Fuel logs.
- **BottomNav**: This component has been removed and should not be used.

## Coding Conventions
- **Icons**: Use inline SVGs with `MailIcon`, `LockIcon`, `UserIcon`, etc., definitions inside the component files or shared UI components.
- **State Sync**: Use `useEffect` for syncing form data with external query results (e.g., auto-filling mileage).
- **Responsive Layout**: Use Tailwind's responsive prefixes (`sm:`, `hidden`, etc.) for UI adjustments.

## Recent Changes (2026-06-06)
- Refactored navigation from BottomNav to TopNav.
- Updated all solid cards to the Glass theme.
- Fixed input field overlap issues in AuthPage.
- Verified build success via `npm run build`.
