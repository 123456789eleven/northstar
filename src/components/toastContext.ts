import { createContext, useContext } from 'react'

export interface ToastOpts { message: string; undo?: () => void | Promise<void>; ms?: number }
export const ToastContext = createContext<(t: ToastOpts) => void>(() => {})
/** `const toast = useToast(); toast({ message: 'Task deleted', undo: restore })` */
export const useToast = () => useContext(ToastContext)
