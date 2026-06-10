/**
 * Re-export typów app-side dla testów. Trzymamy w osobnym pliku
 * żeby nie wciągać całego @/lib/types.ts (które dynamicznie ładuje
 * dependencies typu UserProfile.workouts).
 */

export type UserMode = "fitness" | "cosmetics";
