import React from 'react';
import clsx from 'clsx';
import { BiErrorCircle } from 'react-icons/bi';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, leftIcon, ...props }, ref) => {
        return (
            <div className={clsx("w-full relative", className)}>
                {label && (
                    <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={clsx(
                            "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                            leftIcon && "pl-10",
                            error && "border-destructive focus-visible:ring-destructive"
                        )}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="mt-1 text-xs text-destructive flex items-center">
                        <BiErrorCircle className="mr-1 h-3 w-3" />
                        {error}
                    </p>
                )}
            </div>
        );
    }
);
Input.displayName = "Input";
