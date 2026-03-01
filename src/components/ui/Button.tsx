import React from 'react';
import clsx from 'clsx';
import { ImSpinner8 } from 'react-icons/im';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass' | 'outline';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, ...props }, ref) => {
        const variants = {
            primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25",
            secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            ghost: "hover:bg-accent hover:text-accent-foreground",
            danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            glass: "glass-button hover:bg-white/10 text-white border-white/10",
            outline: "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
        };

        const sizes = {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-4 py-2",
            lg: "h-12 px-8 text-lg",
            icon: "h-10 w-10 p-0 flex items-center justify-center",
        };

        return (
            <button
                ref={ref}
                className={clsx(
                    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                    variants[variant],
                    sizes[size],
                    className
                )}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading && <ImSpinner8 className="mr-2 h-4 w-4 animate-spin" />}
                {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
                {children}
                {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
            </button>
        );
    }
);
Button.displayName = "Button";
