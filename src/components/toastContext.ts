import { createContext, useContext } from 'react'

/** `action` is an optional neutral follow-up (e.g. "Complete goal"); Undo stays the single accent action. */
export interface ToastOpts { message: string; undo?: () => void | Promise<void>; action?: { label: string; run: () => void | Promise<void> }; ms?: number }
export const ToastContext = createContext<(t: ToastOpts) => void>(() => {})
/** `const toast = useToast(); toast({ message: 'Task deleted', undo: restore })` */
export const useToast = () => useContext(ToastContext)
