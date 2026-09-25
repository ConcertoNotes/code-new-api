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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { useDebounce } from '@/hooks/use-debounce'
import { api } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

type UserAccessOption = {
  id: number
  username: string
  display_name: string
  group: string
  status: number
}

type UserVisibleGroups = {
  groups: string[]
  user_group: string
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

type UserOption = {
  value: string
  label: string
}

type UserVisibleGroupsEditorProps = {
  groupOptions: string[]
}

async function fetchUserAccessOptions(
  keyword: string
): Promise<UserAccessOption[]> {
  const response = await api.get<ApiResponse<UserAccessOption[]>>(
    '/api/user/group-access-options',
    { params: { keyword: keyword || undefined } }
  )
  return requireServerSuccess(response.data).data ?? []
}

async function fetchUserVisibleGroups(
  userID: string
): Promise<UserVisibleGroups> {
  const response = await api.get<ApiResponse<UserVisibleGroups>>(
    `/api/user/${userID}/visible-groups`
  )
  return (
    requireServerSuccess(response.data).data ?? { groups: [], user_group: '' }
  )
}

async function saveUserVisibleGroups(params: {
  userID: string
  groups: string[]
}): Promise<void> {
  const response = await api.put<ApiResponse<UserVisibleGroups>>(
    `/api/user/${params.userID}/visible-groups`,
    { groups: params.groups }
  )
  requireServerSuccess(response.data)
}

function formatUserLabel(user: UserAccessOption): string {
  const name = user.display_name.trim() || user.username
  return `${name} (@${user.username}, #${user.id})`
}

export function UserVisibleGroupsEditor(props: UserVisibleGroupsEditorProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
  const [search, setSearch] = useState('')
  const [checkedGroups, setCheckedGroups] = useState<string[]>([])
  const debouncedSearch = useDebounce(search, 250)
  const userID = selectedUser?.value ?? ''

  const usersQuery = useQuery({
    queryKey: ['user-visible-groups', 'users', debouncedSearch],
    queryFn: () => fetchUserAccessOptions(debouncedSearch),
    staleTime: 30_000,
  })
  const visibleGroupsQuery = useQuery({
    queryKey: ['user-visible-groups', 'user', userID],
    queryFn: () => fetchUserVisibleGroups(userID),
    enabled: userID !== '',
  })

  useEffect(() => {
    setCheckedGroups(visibleGroupsQuery.data?.groups ?? [])
  }, [visibleGroupsQuery.data])

  const userOptions = useMemo(() => {
    const options = (usersQuery.data ?? []).map((user) => ({
      value: String(user.id),
      label: formatUserLabel(user),
    }))
    if (
      selectedUser &&
      !options.some((option) => option.value === selectedUser.value)
    ) {
      options.unshift(selectedUser)
    }
    return options
  }, [usersQuery.data, selectedUser])

  const saveMutation = useMutation({
    mutationFn: saveUserVisibleGroups,
    onSuccess: () => {
      toast.success(t('Visible groups saved'))
      void queryClient.invalidateQueries({
        queryKey: ['user-visible-groups', 'user', userID],
      })
    },
    onError: (error) => handleServerError(error),
  })

  const toggleGroup = (group: string, checked: boolean) => {
    setCheckedGroups((current) => {
      if (!checked) return current.filter((item) => item !== group)
      if (current.includes(group)) return current
      return [...current, group]
    })
  }

  const userGroup = visibleGroupsQuery.data?.user_group ?? ''

  return (
    <Card className='min-w-0 shadow-none'>
      <CardHeader className='gap-2 border-b'>
        <CardTitle>{t('User visible groups')}</CardTitle>
        <CardDescription>
          {t(
            'Select a user, then check the groups this user can see and use. Unchecked groups are hidden from this user. If no group is checked, the default visibility rules apply.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <Combobox
          items={userOptions}
          value={selectedUser}
          onValueChange={(option: UserOption | null) => setSelectedUser(option)}
          onInputValueChange={setSearch}
          itemToStringLabel={(option: UserOption) => option.label}
        >
          <ComboboxInput
            aria-label={t('Search users...')}
            placeholder={t('Search users...')}
          />
          <ComboboxContent>
            <ComboboxEmpty>{t('No users')}</ComboboxEmpty>
            <ComboboxList>
              {(option: UserOption) => (
                <ComboboxItem key={option.value} value={option}>
                  {option.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        {userID === '' ? (
          <EmptyState
            className='min-h-32'
            title={t('No user selected')}
            description={t('Search and select a user to edit visible groups.')}
          />
        ) : (
          <>
            <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
              {props.groupOptions.map((group) => {
                const checkboxID = `user-visible-group-${group}`
                return (
                  <div
                    key={group}
                    className='flex items-center gap-2 rounded-md border px-3 py-2'
                  >
                    <Checkbox
                      id={checkboxID}
                      checked={checkedGroups.includes(group)}
                      disabled={visibleGroupsQuery.isLoading}
                      onCheckedChange={(checked) =>
                        toggleGroup(group, checked === true)
                      }
                    />
                    <Label htmlFor={checkboxID} className='min-w-0 truncate'>
                      {group}
                    </Label>
                  </div>
                )
              })}
            </div>
            {userGroup !== '' && (
              <p className='text-muted-foreground text-sm'>
                {t(
                  "The user's own group ({{group}}) always stays visible.",
                  { group: userGroup }
                )}
              </p>
            )}
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setCheckedGroups([...props.groupOptions])}
              >
                {t('Select all')}
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => setCheckedGroups([])}
              >
                {t('Clear')}
              </Button>
              <Button
                type='button'
                disabled={
                  saveMutation.isPending || visibleGroupsQuery.isLoading
                }
                onClick={() =>
                  saveMutation.mutate({ userID, groups: checkedGroups })
                }
              >
                {saveMutation.isPending ? t('Saving...') : t('Save')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
