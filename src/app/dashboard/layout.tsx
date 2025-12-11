'use client'

import { UserButton } from '@clerk/nextjs'
import { GlobeIcon, LayoutDashboardIcon, UploadIcon, MailIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@/components/ui/sidebar'

const menuItems = [
  { icon: LayoutDashboardIcon, label: 'Dashboard', href: '/dashboard' },
]

const domainItems = [
  { icon: UploadIcon, label: 'Datenbank', href: '/dashboard/csv-import' },
  { icon: GlobeIcon, label: 'Meine Domains', href: '/dashboard/domains' },
  { icon: MailIcon, label: 'Email Weiterleitung', href: '/dashboard/email' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className='bg-muted flex min-h-dvh w-full'>
      <SidebarProvider>
        <Sidebar collapsible='icon' className='[&_[data-slot=sidebar-inner]]:bg-muted !border-r-0'>
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size='lg' className='gap-2.5' asChild>
                  <Link href='/dashboard'>
                    <GlobeIcon className='size-6' />
                    <span className='text-xl font-semibold'>Domain Manager</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map(item => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        tooltip={item.label}
                        isActive={pathname === item.href}
                        asChild
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Domains</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {domainItems.map(item => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        tooltip={item.label}
                        isActive={pathname === item.href}
                        asChild
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className='flex flex-1 flex-col'>
          <header className='bg-muted sticky top-0 z-50 flex items-center justify-between gap-6 px-4 py-2 sm:px-6'>
            <div className='flex items-center gap-4'>
              <SidebarTrigger className='[&_svg]:!size-5' />
              <Separator orientation='vertical' className='hidden !h-4 sm:block' />
              <h1 className='text-lg font-semibold'>Domain Manager</h1>
            </div>
            <UserButton />
          </header>
          <main className='size-full flex-1 px-4 py-6 sm:px-6'>
            {children}
          </main>
        </div>
      </SidebarProvider>
    </div>
  )
}
