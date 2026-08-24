/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebounce } from '@/hooks/use-debounce'
import { api } from '@/lib/api'

const sectionCardClassName =
  'relative shadow-sm ring-0 before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:border before:border-border/90'
const sectionHeaderClassName = 'border-b bg-muted/20'

type GroupUserAllowlist = Record<string, number[]>

type UserAccessOption = {
  id: number
  username: string
  display_name: string
  group: string
  status: number
}

type ApiResponse<T> = {
  success: boolean
  data?: T
}

type GroupUserAllowlistEditorProps = {
  value: string
  groupOptions: string[]
  onChange: (value: string) => void
}

function parseAllowlist(value: string): GroupUserAllowlist {
  try {
    const parsed = JSON.parse(value) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {}
    }
    const allowlist: GroupUserAllowlist = {}
    for (const [group, rawUserIDs] of Object.entries(parsed)) {
      if (!group || !Array.isArray(rawUserIDs)) continue
      const userIDs = rawUserIDs.filter(
        (userID): userID is number =>
          Number.isInteger(userID) && Number(userID) > 0
      )
      if (userIDs.length > 0) {
        allowlist[group] = [...new Set(userIDs)]
      }
    }
    return allowlist
  } catch {
    return {}
  }
}

function serializeAllowlist(allowlist: GroupUserAllowlist): string {
  const sorted = Object.fromEntries(
    Object.entries(allowlist)
      .filter(([, userIDs]) => userIDs.length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([group, userIDs]) => [group, [...userIDs].sort((a, b) => a - b)])
  )
  return JSON.stringify(sorted, null, 2)
}

async function fetchUserAccessOptions(params: {
  keyword?: string
  userIDs?: number[]
}): Promise<UserAccessOption[]> {
  const response = await api.get<ApiResponse<UserAccessOption[]>>(
    '/api/user/group_access_options',
    {
      params: {
        keyword: params.keyword || undefined,
        ids: params.userIDs?.join(',') || undefined,
      },
    }
  )
  return response.data.data ?? []
}

function formatUserLabel(user: UserAccessOption): string {
  const name = user.display_name.trim() || user.username
  return `${name} (@${user.username}, #${user.id})`
}

export function GroupUserAllowlistEditor(props: GroupUserAllowlistEditorProps) {
  const { t } = useTranslation()
  const [group, setGroup] = useState('')
  const [userID, setUserID] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const allowlist = useMemo(() => parseAllowlist(props.value), [props.value])
  const selectedUserIDs = useMemo(
    () => [...new Set(Object.values(allowlist).flat())],
    [allowlist]
  )

  const selectedUsersQuery = useQuery({
    queryKey: ['group-user-access-options', 'selected', selectedUserIDs],
    queryFn: () => fetchUserAccessOptions({ userIDs: selectedUserIDs }),
    enabled: selectedUserIDs.length > 0,
    staleTime: 60_000,
  })
  const searchUsersQuery = useQuery({
    queryKey: ['group-user-access-options', 'search', debouncedSearch],
    queryFn: () => fetchUserAccessOptions({ keyword: debouncedSearch }),
    staleTime: 30_000,
  })

  const usersByID = useMemo(() => {
    const users = new Map<number, UserAccessOption>()
    for (const user of selectedUsersQuery.data ?? []) users.set(user.id, user)
    for (const user of searchUsersQuery.data ?? []) users.set(user.id, user)
    return users
  }, [searchUsersQuery.data, selectedUsersQuery.data])

  const userOptions = useMemo(
    () =>
      [...usersByID.values()].map((user) => ({
        value: String(user.id),
        label: formatUserLabel(user),
      })),
    [usersByID]
  )
  const groupItems = useMemo(
    () => props.groupOptions.map((value) => ({ label: value, value })),
    [props.groupOptions]
  )

  const addAccess = () => {
    const parsedUserID = Number(userID)
    if (!group || !Number.isInteger(parsedUserID) || parsedUserID <= 0) return
    const currentUserIDs = allowlist[group] ?? []
    if (currentUserIDs.includes(parsedUserID)) return
    props.onChange(
      serializeAllowlist({
        ...allowlist,
        [group]: [...currentUserIDs, parsedUserID],
      })
    )
    setUserID('')
    setSearch('')
  }

  const removeAccess = (targetGroup: string, targetUserID: number) => {
    const nextUserIDs = (allowlist[targetGroup] ?? []).filter(
      (id) => id !== targetUserID
    )
    const nextAllowlist = { ...allowlist }
    if (nextUserIDs.length === 0) {
      delete nextAllowlist[targetGroup]
    } else {
      nextAllowlist[targetGroup] = nextUserIDs
    }
    props.onChange(serializeAllowlist(nextAllowlist))
  }

  return (
    <Card className={sectionCardClassName}>
      <CardHeader className={sectionHeaderClassName}>
        <CardTitle>{t('User-specific group access')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]'>
          <Select
            items={groupItems}
            value={group === '' ? null : group}
            onValueChange={(value) => {
              if (typeof value === 'string') setGroup(value)
            }}
          >
            <SelectTrigger className='w-full' aria-label={t('Group')}>
              <SelectValue placeholder={t('Group')} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {props.groupOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Combobox
            options={userOptions}
            value={userID}
            onValueChange={(value) => setUserID(value ?? '')}
            onSearchValueChange={setSearch}
            placeholder={t('Search users...')}
            emptyText={t('No users')}
          />

          <Button
            type='button'
            onClick={addAccess}
            disabled={!group || !userID}
          >
            <Plus className='h-4 w-4' aria-hidden='true' />
            {t('Add')}
          </Button>
        </div>

        {Object.keys(allowlist).length === 0 ? (
          <p className='text-muted-foreground py-4 text-center text-sm'>
            {t('No rules yet')}
          </p>
        ) : (
          <div className='space-y-3'>
            {Object.entries(allowlist).map(([targetGroup, userIDs]) => (
              <div
                key={targetGroup}
                className='overflow-hidden rounded-lg border'
              >
                <div className='bg-muted/20 flex items-center justify-between px-3 py-2'>
                  <span className='font-medium'>{targetGroup}</span>
                  <StatusBadge variant='neutral' copyable={false}>
                    {userIDs.length}
                  </StatusBadge>
                </div>
                <div className='divide-y'>
                  {userIDs.map((allowedUserID) => {
                    const user = usersByID.get(allowedUserID)
                    return (
                      <div
                        key={allowedUserID}
                        className='flex min-w-0 items-center gap-2 px-3 py-2'
                      >
                        <UserRound
                          className='text-muted-foreground h-4 w-4 shrink-0'
                          aria-hidden='true'
                        />
                        <span className='min-w-0 flex-1 truncate text-sm'>
                          {user ? formatUserLabel(user) : `#${allowedUserID}`}
                        </span>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='text-destructive h-8 w-8 p-0'
                          aria-label={t('Remove')}
                          onClick={() =>
                            removeAccess(targetGroup, allowedUserID)
                          }
                        >
                          <Trash2 className='h-4 w-4' aria-hidden='true' />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
