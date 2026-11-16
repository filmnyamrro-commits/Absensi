interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = 'w-8 h-8' }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="8" fill="#1D4ED8" />
      <path
        d="M18 7L28 11.5V18.5C28 24.3 23.7 29.1 18 30.5C12.3 29.1 8 24.3 8 18.5V11.5L18 7Z"
        fill="#FFFFFF"
        fillOpacity="0.16"
        stroke="#FFFFFF"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 18.5L16.5 21.5L23 15"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
