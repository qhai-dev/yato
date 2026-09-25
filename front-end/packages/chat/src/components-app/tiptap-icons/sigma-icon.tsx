import { memo } from "react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

export const SigmaIcon = memo(({ className, ...props }: SvgProps) => {
    return (
        <svg
            width="24"
            height="24"
            className={className}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.10558 3.55279C5.27497 3.214 5.62123 3 6.00001 3H18C18.5523 3 19 3.44772 19 4V7C19 7.55228 18.5523 8 18 8C17.4477 8 17 7.55228 17 7V5H8.00001L12.8 11.4C13.0667 11.7556 13.0667 12.2444 12.8 12.6L8.00001 19H17V17C17 16.4477 17.4477 16 18 16C18.5523 16 19 16.4477 19 17V20C19 20.5523 18.5523 21 18 21H6.00001C5.62123 21 5.27497 20.786 5.10558 20.4472C4.93619 20.1084 4.97274 19.703 5.20001 19.4L10.75 12L5.20001 4.6C4.97274 4.29698 4.93619 3.89157 5.10558 3.55279Z"
                fill="currentColor"
            />
        </svg>
    )
})

SigmaIcon.displayName = "SigmaIcon"
