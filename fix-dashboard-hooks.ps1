$path = 'C:\project\wamapp\my-expo-app\app\(tabs)\dashboard\index.tsx'
$lines = [System.Collections.Generic.List[string]]::new()
(Get-Content $path) | ForEach-Object { [void]$lines.Add($_) }

for ($i = $lines.Count - 1; $i -ge 0; $i--) {
  if ($lines[$i] -match 'notificationsLoading') {
    $lines.RemoveAt($i)
  }
}

$ifIndex = $lines.IndexOf('  if (isLoading && !data) {')
$visibleIndex = $lines.IndexOf('  const visibleNotification = useMemo(() => {')
$handleIndex = $lines.IndexOf('  const handleDismissNotification = async () => {')

if ($ifIndex -lt 0 -or $visibleIndex -lt 0 -or $handleIndex -lt 0) {
  throw 'Expected dashboard markers were not found.'
}

$ifBlock = @(
  '  if (isLoading && !data) {'
  '    return <DashboardSkeleton />;'
  '  }'
)

$block = $lines.GetRange($ifIndex, $visibleIndex - $ifIndex)
$lines.RemoveRange($ifIndex, $visibleIndex - $ifIndex)

$handleIndex = $lines.IndexOf('  const handleDismissNotification = async () => {')
$endHandleIndex = -1
for ($i = $handleIndex; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -eq '  };') {
    $endHandleIndex = $i
    break
  }
}

if ($endHandleIndex -lt 0) {
  throw 'Could not locate end of handleDismissNotification block.'
}

$insertAt = $endHandleIndex + 1
$lines.InsertRange($insertAt, $ifBlock)

Set-Content -Path $path -Value $lines
