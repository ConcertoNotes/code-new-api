import { zodResolver } from '@hookform/resolvers/zod'
import dayjs from 'dayjs'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z
  .object({
    enabled: z.boolean(),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    thresholdMoney: z.coerce.number().positive(),
    payoutRatio: z.coerce.number().min(0).max(1),
    reserveQuota: z.coerce.number().min(0),
  })
  .refine((v) => dayjs(v.endTime).isAfter(dayjs(v.startTime)), {
    path: ['endTime'],
    message: 'End time must be after start time',
  })

type Values = z.infer<typeof schema>

export interface LotterySettingsDefaults {
  enabled: boolean
  startTime: number
  endTime: number
  thresholdMoney: number
  payoutRatio: number
  reserveQuota: number
}

const toLocalInput = (ts: number) => dayjs.unix(ts).format('YYYY-MM-DDTHH:mm')

export function LotterySettingsSection(props: {
  defaultValues: LotterySettingsDefaults
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const defaults = props.defaultValues

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaults.enabled,
      startTime: toLocalInput(defaults.startTime),
      endTime: toLocalInput(defaults.endTime),
      thresholdMoney: defaults.thresholdMoney,
      payoutRatio: defaults.payoutRatio,
      reserveQuota: defaults.reserveQuota,
    },
  })
  const { isDirty, isSubmitting } = form.formState
  const busy = updateOption.isPending || isSubmitting

  async function onSubmit(values: Values) {
    const next = {
      'lottery_setting.enabled': String(values.enabled),
      'lottery_setting.start_time': String(dayjs(values.startTime).unix()),
      'lottery_setting.end_time': String(dayjs(values.endTime).unix()),
      'lottery_setting.threshold_money': String(values.thresholdMoney),
      'lottery_setting.payout_ratio': String(values.payoutRatio),
      'lottery_setting.reserve_quota': String(values.reserveQuota),
    }
    const current: Record<keyof typeof next, string> = {
      'lottery_setting.enabled': String(defaults.enabled),
      'lottery_setting.start_time': String(defaults.startTime),
      'lottery_setting.end_time': String(defaults.endTime),
      'lottery_setting.threshold_money': String(defaults.thresholdMoney),
      'lottery_setting.payout_ratio': String(defaults.payoutRatio),
      'lottery_setting.reserve_quota': String(defaults.reserveQuota),
    }
    const updates = (Object.keys(next) as Array<keyof typeof next>)
      .filter((key) => next[key] !== current[key])
      .map((key) => ({ key, value: next[key] }))
    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
    form.reset(values)
  }

  const numberField = (
    name: 'thresholdMoney' | 'payoutRatio' | 'reserveQuota',
    label: string,
    description: string,
    step: string
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type='number' min={0} step={step} {...field} />
          </FormControl>
          <FormDescription>{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <SettingsSection title={t('Lottery Settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={busy}
            isSaveDisabled={!isDirty}
            saveLabel='Save lottery settings'
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable recharge lottery')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Turning this off hides the lottery card and rejects every draw immediately'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={busy}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
          <div className='grid gap-6 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='startTime'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Lottery start time')}</FormLabel>
                  <FormControl>
                    <Input type='datetime-local' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='endTime'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Lottery end time')}</FormLabel>
                  <FormControl>
                    <Input type='datetime-local' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {numberField(
              'thresholdMoney',
              t('Recharge amount per draw'),
              t('Paid amount (in payment currency) needed for one draw'),
              '1'
            )}
            {numberField(
              'payoutRatio',
              t('Max payout ratio'),
              t(
                'Total prizes never exceed event recharges × this ratio. Keep it below your gross margin to stay profitable.'
              ),
              '0.01'
            )}
            {numberField(
              'reserveQuota',
              t('Reserve quota'),
              t(
                'Quota held back from the prize budget, e.g. to cover server costs'
              ),
              '1'
            )}
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
