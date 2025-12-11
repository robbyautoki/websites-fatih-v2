'use client'

import { Line, LineChart } from 'recharts'

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

import { cn } from '@/lib/utils'

// Impression chart data
const impressionChartData = [
  { month: 'January', impression: 20 },
  { month: 'February', impression: 20 },
  { month: 'March', impression: 50 },
  { month: 'April', impression: 50 },
  { month: 'May', impression: 30 },
  { month: 'June', impression: 30 },
  { month: 'July', impression: 5 },
  { month: 'August', impression: 5 },
  { month: 'September', impression: 50 },
  { month: 'October', impression: 50 },
  { month: 'November', impression: 105 },
  { month: 'December', impression: 105 }
]

const impressionChartConfig = {
  impression: {
    label: 'Impressions',
    color: 'var(--chart-5)'
  }
} satisfies ChartConfig

const StatisticsCardData = {
  title: 'Impression',
  description: 'Last year',
  children: (
    <>
      <ChartContainer config={impressionChartConfig} className='h-21 w-full px-4.5'>
        <LineChart
          accessibilityLayer
          data={impressionChartData}
          margin={{
            left: 6,
            right: 6
          }}
        >
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Line dataKey='impression' type='linear' dot={false} stroke='var(--color-impression)' strokeWidth={3} />
        </LineChart>
      </ChartContainer>
    </>
  ),
  value: '175K',
  changePercentage: '+24%'
}

const StatisticsImpressionCard = ({ className }: { className?: string }) => {
  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader className='gap-0'>
        <CardTitle className='text-lg font-semibold'>{StatisticsCardData.title}</CardTitle>
        <CardDescription className='text-muted-foreground text-base'>{StatisticsCardData.description}</CardDescription>
      </CardHeader>
      {StatisticsCardData.children}

      <CardFooter className='justify-between'>
        <span className='text-xl font-semibold'>{StatisticsCardData.value}</span>
        <span className='text-primary'>{StatisticsCardData.changePercentage}</span>
      </CardFooter>
    </Card>
  )
}

export default StatisticsImpressionCard
