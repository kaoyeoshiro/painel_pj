import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { ToastProvider } from '@/components/ui/toast'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <RouterProvider router={router} />
  </ToastProvider>,
)
