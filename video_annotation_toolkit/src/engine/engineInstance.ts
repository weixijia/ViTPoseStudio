import { VideoEngine } from './VideoEngine';

/** Single shared engine for the app (one video open at a time). */
export const engine = new VideoEngine();
