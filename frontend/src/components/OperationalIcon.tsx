import type { ReactNode } from "react";
export type OperationalIconName = "package"|"user"|"code"|"server"|"search"|"check"|"warning";
const paths: Record<OperationalIconName, ReactNode> = {
  package:<><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></>, user:<><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.5-4.2 2.8-6.3 7-6.3s6.5 2.1 7 6.3"/></>, code:<><path d="m8 6-5 6 5 6M16 6l5 6-5 6M14 4l-4 16"/></>, server:<><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/></>, search:<><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5M8.5 11l1.7 1.7 3.6-4"/></>, check:<><path d="M20 11.5V12a8 8 0 1 1-4.7-7.3"/><path d="m8.5 11.5 2.3 2.3L21 4"/></>, warning:<><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
};
export function OperationalIcon({name}:{name:OperationalIconName}) { return <svg className="operational-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>; }
