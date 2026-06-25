interface AppLogoProps {
  size?: 'sm' | 'md'
  className?: string
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
}

export function AppLogo({ size = 'md', className = '' }: AppLogoProps) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      aria-hidden="true"
      className={`shrink-0 rounded-xl object-contain shadow-soft ${sizeClasses[size]} ${className}`}
    />
  )
}
