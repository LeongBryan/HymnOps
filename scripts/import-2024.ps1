param(
  [string]$CsvPath = "imports/2024.csv",
  [int]$ServiceYear = 2024
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$songsDir = Join-Path $root "songs"
$servicesDir = Join-Path $root "services"
$seriesDir = Join-Path $root "series"
$csvFullPath = Join-Path $root $CsvPath
$importCsvLabel = ($CsvPath -replace "\\", "/")
$importTag = "import-$ServiceYear"

function Normalize-Whitespace([string]$value) {
  if ($null -eq $value) {
    return ""
  }
  return (($value -replace "\s+", " ").Trim())
}

function Normalize-Key([string]$value) {
  $normalized = Normalize-Whitespace $value
  return (($normalized.ToLower() -replace "[^a-z0-9]+", " ").Trim())
}

function Slugify([string]$value) {
  $normalized = Normalize-Whitespace $value
  $normalized = $normalized.ToLower()
  $normalized = $normalized -replace "&", " and "
  $normalized = $normalized -replace "['\u2019]", ""
  $normalized = $normalized -replace "[^a-z0-9]+", "-"
  $normalized = $normalized.Trim("-")
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return "untitled"
  }
  return $normalized
}

function Quote-Yaml([string]$value) {
  if ($null -eq $value) {
    return "null"
  }
  $escaped = $value.Replace('"', '\"')
  return '"' + $escaped + '"'
}

function Parse-ServiceDate([string]$value, [int]$year) {
  $text = Normalize-Whitespace $value
  $formats = @("d MMM", "d MMMM")
  $dt = $null
  foreach ($fmt in $formats) {
    try {
      $dt = [datetime]::ParseExact($text, $fmt, [System.Globalization.CultureInfo]::InvariantCulture)
      break
    }
    catch {
    }
  }
  if ($null -eq $dt) {
    throw "Unrecognized date format: '$text'"
  }
  $withYear = Get-Date -Year $year -Month $dt.Month -Day $dt.Day
  return $withYear.ToString("yyyy-MM-dd")
}

if (-not (Test-Path $csvFullPath)) {
  throw "CSV not found: $csvFullPath"
}

$correctionPairs = @(
  @("mighty mighty saviour", "Mighty Mighty Saviour"),
  @("MIghty Mighty Saviour", "Mighty Mighty Saviour"),
  @("In Christ Alone (getty)", "In Christ Alone (Getty)"),
  @("What Grace is Mine", "What Grace Is Mine"),
  @("Lord I Lift Your name on high", "Lord I Lift Your Name On High"),
  @("Lead me to Calvary", "Lead Me To Calvary"),
  @("Christ is Risen He is Risen Indeed", "Christ Is Risen, He Is Risen Indeed"),
  @("Hymn Of the Saviour", "Hymn Of The Saviour"),
  @("There Is a Hope", "There Is A Hope"),
  @("Jesus Is the King", "Jesus Is The King"),
  @("Jesus is the King", "Jesus Is The King"),
  @("Crown Him with many Crowns", "Crown Him With Many Crowns"),
  @("Come People of the Risen King", "Come People Of The Risen King"),
  @("There is One Gospel", "There Is One Gospel"),
  @("King of Kings", "King Of Kings"),
  @("I Have Decided to Follow Jesus", "I Have Decided To Follow Jesus"),
  @("Jesus Came to Earth", "Jesus Came To Earth"),
  @("God the Uncreated One", "God The Uncreated One"),
  @("Amazing Grace (hymn)", "Amazing Grace (Hymn)"),
  @("No other Name (Emu)", "No Other Name (Emu)"),
  @("Great Is The Lord (and most worthy of praise)", "Great Is The Lord (And Most Worthy Of Praise)"),
  @("Trust and Obey", "Trust And Obey"),
  @("Goodness of Jesus", "Goodness Of Jesus"),
  @("Goodness of God", "Goodness Of God"),
  @("Come Praise and Glorify", "Come Praise And Glorify"),
  @("Tis so Sweet To Trust In Jesus", "'Tis So Sweet To Trust In Jesus"),
  @("OThe Wonderful Cross", "O The Wonderful Cross"),
  @("Beneath The Cross of Jesus", "Beneath The Cross Of Jesus"),
  @("Holy Spirit Living Breath of God", "Holy Spirit, Living Breath Of God"),
  @("What a Friend We Have In Jesus", "What A Friend We Have In Jesus"),
  @("Meekness and Majesty", "Meekness And Majesty"),
  @("Man of Sorrows", "Man Of Sorrows"),
  @("All Hail The Power of Jesus Name", "All Hail The Power Of Jesus' Name"),
  @("O Come O Come Emmanuel", "O Come, O Come Emmanuel"),
  @("Joy To The World (King of Kings)", "Joy To The World (King Of Kings)"),
  @("Crown Him King of Kings", "Crown Him King Of Kings"),
  @("Hark the Herald Angels Sing", "Hark The Herald Angels Sing"),
  @("Angels We Have Heard on High", "Angels We Have Heard On High"),
  @("O Little Town of Bethlehem", "O Little Town Of Bethlehem"),
  @("What Child is This", "What Child Is This"),
  @("It Came Upon a Midnight Clear", "It Came Upon A Midnight Clear"),
  @("My Hope is Built on Nothing Less", "My Hope Is Built On Nothing Less"),
  @("Christ is Enough", "Christ Is Enough"),
  @("Christ is Mine Forevermore", "Christ Is Mine Forevermore"),
  @("We will Feast", "We Will Feast"),
  @("Hallelujah, What a Saviour", "Hallelujah, What A Saviour"),
  @("Y", "Yet Not I"),
  @("There's No Greater Love", "No Greater Love"),
  @("Rejoice the Lord is King", "Rejoice The Lord Is King"),
  @("Hymn of the saviour", "Hymn Of The Saviour"),
  @("Turn your eyes", "Turn Your Eyes"),
  @("I stand amazed", "I Stand Amazed"),
  @("My heart is filled with thankfulness", "My Heart Is Filled With Thankfulness"),
  @("Come thou Fount (Chris Tomlin ver)", "Come Thou Fount"),
  @("Only a Holy God", "Only A Holy God"),
  @("There is one gospel", "There Is One Gospel"),
  @("O church arise", "O Church Arise"),
  @("Christ has Risen", "Christ Has Risen"),
  @("Christ Our Hope In Life and Death", "Christ Our Hope In Life And Death"),
  @("Take heart", "Take Heart"),
  @("Come Priase and Glorify", "Come Praise And Glorify"),
  @("All I have is Christ", "All I Have Is Christ"),
  @("The Wonderful Cross", "O The Wonderful Cross"),
  @("Your Love (will last forever)", "Your Love"),
  @("Great is the Lord and most worthy", "Great Is The Lord (And Most Worthy Of Praise)"),
  @("The Battle and thne Blessing", "The Battle and the Blessing"),
  @("Jesus Shall Take the highest honour", "Jesus Shall Take The Highest Honour"),
  @("I Stand in awe of you", "I Stand In Awe Of You"),
  @("How Good it Is", "O How Good It Is"),
  @("Psalm 150 (praise the lord)", "Psalm 150 (Praise The Lord)"),
  @("The Lord is my Salvation", "The Lord Is My Salvation"),
  @("He Calls me Friend", "He Calls Me Friend"),
  @("I'm gonna be like a tree", "Be Like A Tree"),
  @("Everlasting God (strength will rise)", "Everlasting God"),
  @("How Excellent Your name", "How Excellent Your Name"),
  @("Bless The Lord O my Soul", "Bless The Lord O My Soul"),
  @("His Mercy is More", "His Mercy Is More"),
  @("The Love of God", "The Love Of God"),
  @("The Goodness of Jesus", "Goodness Of Jesus"),
  @("Before the Throne of God Above", "Before The Throne Of God Above"),
  @("It was Finished Upon That Cross", "It Was Finished Upon That Cross"),
  @("Still, my Soul Be Still", "Still My Soul Be Still"),
  @("Let Us Exalt his Name", "Let Us Exalt His Name"),
  @("Lord of Lords", "Lord Of Lords"),
  @("God's Big Family", "God's Great Family"),
  @("I Am The way The Truth And The Life", "I Am The Way The Truth And The Life"),
  @("I Am the way The Truth And The Life", "I Am The Way The Truth And The Life"),
  @("How Deep The Father's Love", "How Deep The Father's Love For Us"),
  @("I Love You lord (and I lift my voice)", "I Love You Lord (And I Lift My Voice)"),
  @("Lord I Lift Your name On High", "Lord I Lift Your Name On High"),
  @("His Banner Over me Is Love", "His Banner Over Me Is Love"),
  @("Take My Life and Let It Be", "Take My Life And Let It Be"),
  @("Be Still, my Soul", "Be Still My Soul"),
  @("All to Jesus I Surrender", "All To Jesus I Surrender"),
  @("He WIll Hold Me Fast", "He Will Hold Me Fast"),
  @("Beneath The Cross of Jesus", "Beneath The Cross Of Jesus"),
  @("There Is a Redeemer (Keith Green)", "There Is A Redeemer (Keith Green)"),
  @("I Stand Amazed (Glasbyrd)", "I Stand Amazed"),
  @("The Steadast Love Of the Lord never ceases", "The Steadfast Love Of The Lord Never Ceases"),
  @("I Will Sing of My Redeemer", "I Will Sing Of My Redeemer"),
  @("Jesus SHall Take the highest honour", "Jesus Shall Take The Highest Honour"),
  @("How Deep the Father's Love For Us", "How Deep The Father's Love For Us"),
  @("He Leadeth me", "He Leadeth Me"),
  @("Known & Loved", "Known and Loved"),
  @("King of kings", "King Of Kings"),
  @("Goodness of Jesus", "Goodness Of Jesus"),
  @("Ancient of Days", "Ancient Of Days"),
  @("Hallelujah What A Saviour", "Hallelujah, What A Saviour"),
  @("Fill my Eyes O My God", "Fill My Eyes O My God")
)
$corrections = @{}
foreach ($pair in $correctionPairs) {
  $corrections[$pair[0]] = $pair[1]
}

$rows = Import-Csv $csvFullPath
if ($rows.Count -eq 0) {
  throw "CSV is empty: $csvFullPath"
}

$existingSongFiles = Get-ChildItem $songsDir -File -Filter "*.md" | Where-Object { $_.Name -ne "_template.md" }
$existingSongTitleKeyToSlug = @{}
$allSongSlugs = New-Object "System.Collections.Generic.HashSet[string]"

foreach ($file in $existingSongFiles) {
  $slug = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
  [void]$allSongSlugs.Add($slug)

  $titleLine = Get-Content $file.FullName -TotalCount 60 | Where-Object { $_ -match '^title:\s*".*"\s*$' } | Select-Object -First 1
  if ($titleLine) {
    $title = ($titleLine -replace '^title:\s*"', "") -replace '"\s*$', ""
    $key = Normalize-Key $title
    if (-not [string]::IsNullOrWhiteSpace($key) -and -not $existingSongTitleKeyToSlug.ContainsKey($key)) {
      $existingSongTitleKeyToSlug[$key] = $slug
    }
  }
}

$processed = New-Object "System.Collections.Generic.List[object]"
for ($i = 0; $i -lt $rows.Count; $i++) {
  $row = $rows[$i]
  $rawTitle = Normalize-Whitespace $row."Song Title"
  $serviceDateText = Normalize-Whitespace $row."Date of Service"
  $seriesTitle = Normalize-Whitespace $row."Sermon Series"

  if ([string]::IsNullOrWhiteSpace($rawTitle) -or [string]::IsNullOrWhiteSpace($serviceDateText)) {
    continue
  }

  $title = if ($corrections.ContainsKey($rawTitle)) { $corrections[$rawTitle] } else { $rawTitle }
  $dateIso = Parse-ServiceDate $serviceDateText $ServiceYear

  $processed.Add([pscustomobject]@{
      RowIndex = $i
      RawTitle = $rawTitle
      Title = $title
      SongKey = (Normalize-Key $title)
      DateText = $serviceDateText
      DateIso = $dateIso
      SeriesTitle = $seriesTitle
    })
}

if ($processed.Count -eq 0) {
  throw "No usable rows parsed from CSV."
}

$songGroups = $processed | Group-Object SongKey
$generatedSongSlugs = New-Object "System.Collections.Generic.HashSet[string]"
$songRecords = New-Object "System.Collections.Generic.List[object]"

foreach ($group in $songGroups) {
  if ([string]::IsNullOrWhiteSpace($group.Name)) {
    continue
  }
  $items = $group.Group
  $titleCounts = $items |
    Group-Object Title |
    Sort-Object -Property @{ Expression = "Count"; Descending = $true }, @{ Expression = "Name"; Descending = $false }
  $canonicalTitle = $titleCounts[0].Name

  $slug = $null
  $existing = $false
  if ($existingSongTitleKeyToSlug.ContainsKey($group.Name)) {
    $slug = $existingSongTitleKeyToSlug[$group.Name]
    $existing = $true
  }
  else {
    $baseSlug = Slugify $canonicalTitle
    $slug = $baseSlug
    $suffix = 2
    while ($allSongSlugs.Contains($slug) -or $generatedSongSlugs.Contains($slug)) {
      $slug = "$baseSlug-$suffix"
      $suffix += 1
    }
    [void]$generatedSongSlugs.Add($slug)
    [void]$allSongSlugs.Add($slug)
  }

  $akaValues = $items | Select-Object -ExpandProperty RawTitle -Unique | Where-Object { $_ -ne $canonicalTitle }
  $lastSung = ($items | Sort-Object DateIso -Descending | Select-Object -First 1).DateIso

  $songRecords.Add([pscustomobject]@{
      SongKey = $group.Name
      Title = $canonicalTitle
      Slug = $slug
      Akas = @($akaValues)
      LastSung = $lastSung
      Existing = $existing
    })
}

$songKeyToSlug = @{}
foreach ($song in $songRecords) {
  $songKeyToSlug[$song.SongKey] = $song.Slug
}

$createdSongs = 0
foreach ($song in $songRecords) {
  if ($song.Existing) {
    continue
  }

  $songPath = Join-Path $songsDir ($song.Slug + ".md")
  $lines = New-Object "System.Collections.Generic.List[string]"
  $lines.Add("---")
  $lines.Add("title: $(Quote-Yaml $song.Title)")
  $lines.Add("slug: $(Quote-Yaml $song.Slug)")
  if ($song.Akas.Count -eq 0) {
    $lines.Add("aka: []")
  }
  else {
    $lines.Add("aka:")
    foreach ($aka in $song.Akas) {
      $lines.Add("  - $(Quote-Yaml $aka)")
    }
  }
  $lines.Add("ccli_number: null")
  $lines.Add("songselect_url: null")
  $lines.Add('lyrics_source: "Unknown"')
  $lines.Add('lyrics_hint: ""')
  $lines.Add("original_artist: null")
  $lines.Add("writers: []")
  $lines.Add("publisher: null")
  $lines.Add("year: null")
  $lines.Add("tempo_bpm: null")
  $lines.Add("key: null")
  $lines.Add("time_signature: null")
  $lines.Add("congregational_fit: null")
  $lines.Add("vocal_range: null")
  $lines.Add("dominant_themes: []")
  $lines.Add("doctrinal_categories: []")
  $lines.Add("emotional_tone: []")
  $lines.Add("scriptural_anchors: []")
  $lines.Add("theological_summary: $(Quote-Yaml "Imported from $importCsvLabel; update with a non-lyrical theological summary.")")
  $lines.Add("arrangement_notes: null")
  $lines.Add("slides_path: null")
  $lines.Add("tags:")
  $lines.Add("  - $(Quote-Yaml $importTag)")
  $lines.Add("last_sung_override: $(Quote-Yaml $song.LastSung)")
  $lines.Add('status: "active"')
  $lines.Add("licensing_notes: null")
  $lines.Add('language: "en"')
  $lines.Add("meter: null")
  $lines.Add("---")
  $lines.Add("")
  $lines.Add("## Notes")
  $lines.Add("")
  $lines.Add("Imported from ``$importCsvLabel``. Add arrangement and preparation notes only (no lyrics).")
  $lines.Add("")
  $lines.Add("## Pastoral Use")
  $lines.Add("")
  $lines.Add("Add practical worship-flow and ministry guidance only (no lyrics).")

  Set-Content -Path $songPath -Value (($lines -join "`n") + "`n") -Encoding utf8
  $createdSongs += 1
}

$seriesTitles = $processed |
  Select-Object -ExpandProperty SeriesTitle -Unique |
  Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

$existingSeriesFiles = Get-ChildItem $seriesDir -File -Filter "*.md" | Where-Object { $_.Name -ne "_template.md" }
$existingSeriesSlugs = $existingSeriesFiles | ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) }
$existingSeriesTitleToSlug = @{}
foreach ($file in $existingSeriesFiles) {
  $slug = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
  $titleLine = Get-Content $file.FullName -TotalCount 40 | Where-Object { $_ -match '^title:\s*".*"\s*$' } | Select-Object -First 1
  if ($titleLine) {
    $title = ($titleLine -replace '^title:\s*"', "") -replace '"\s*$', ""
    if (-not [string]::IsNullOrWhiteSpace($title) -and -not $existingSeriesTitleToSlug.ContainsKey($title)) {
      $existingSeriesTitleToSlug[$title] = $slug
    }
  }
}

$seriesUsedSlugs = New-Object "System.Collections.Generic.HashSet[string]"
foreach ($slug in $existingSeriesSlugs) {
  [void]$seriesUsedSlugs.Add($slug)
}

$seriesSlugByTitle = @{}
foreach ($title in $seriesTitles) {
  if ($existingSeriesTitleToSlug.ContainsKey($title)) {
    $slug = $existingSeriesTitleToSlug[$title]
  }
  else {
    $baseSlug = Slugify $title
    $slug = $baseSlug
    $suffix = 2
    while ($seriesUsedSlugs.Contains($slug)) {
      $slug = "$baseSlug-$suffix"
      $suffix += 1
    }
  }
  [void]$seriesUsedSlugs.Add($slug)
  $seriesSlugByTitle[$title] = $slug
}

$serviceGroups = $processed | Group-Object DateIso
$writtenServices = 0

foreach ($group in $serviceGroups) {
  $dateIso = $group.Name
  $items = $group.Group | Sort-Object RowIndex
  $seriesCounts = $items |
    Group-Object SeriesTitle |
    Sort-Object -Property @{ Expression = "Count"; Descending = $true }, @{ Expression = "Name"; Descending = $false }
  $seriesTitle = if ($seriesCounts.Count -gt 0) { $seriesCounts[0].Name } else { $null }
  $seriesSlug = if ($seriesTitle -and $seriesSlugByTitle.ContainsKey($seriesTitle)) { $seriesSlugByTitle[$seriesTitle] } else { $null }

  $lines = New-Object "System.Collections.Generic.List[string]"
  $lines.Add("---")
  $lines.Add("date: $(Quote-Yaml $dateIso)")
  if ($seriesSlug) {
    $lines.Add("series_slug: $(Quote-Yaml $seriesSlug)")
  }
  else {
    $lines.Add("series_slug: null")
  }
  $lines.Add("sermon_title: null")
  $lines.Add("sermon_text: null")
  $lines.Add("preacher: null")
  $lines.Add("songs:")
  foreach ($item in $items) {
    $songSlug = $songKeyToSlug[$item.SongKey]
    $lines.Add("  - slug: $(Quote-Yaml $songSlug)")
    $lines.Add('    usage: ["main-set"]')
    $lines.Add("    key: null")
    $lines.Add("    notes: null")
  }
  $lines.Add("---")
  $lines.Add("")
  $lines.Add("## Service Notes")
  $lines.Add("")
  $lines.Add("Imported from ``$importCsvLabel``.")

  $servicePath = Join-Path $servicesDir ($dateIso + ".md")
  Set-Content -Path $servicePath -Value (($lines -join "`n") + "`n") -Encoding utf8
  $writtenServices += 1
}

$validServiceFiles = New-Object "System.Collections.Generic.HashSet[string]"
foreach ($group in $serviceGroups) {
  [void]$validServiceFiles.Add($group.Name + ".md")
}
$removedServices = 0
Get-ChildItem $servicesDir -File -Filter ($ServiceYear.ToString() + "-*.md") | ForEach-Object {
  if (-not $validServiceFiles.Contains($_.Name)) {
    [System.IO.File]::Delete($_.FullName)
    $removedServices += 1
  }
}

$writtenSeries = 0
foreach ($title in $seriesTitles) {
  $slug = $seriesSlugByTitle[$title]
  $items = $processed | Where-Object { $_.SeriesTitle -eq $title }
  $startDate = ($items | Sort-Object DateIso | Select-Object -First 1).DateIso
  $endDate = ($items | Sort-Object DateIso -Descending | Select-Object -First 1).DateIso
  $recommended = $items |
    Group-Object SongKey |
    Sort-Object -Property @{ Expression = "Count"; Descending = $true }, @{ Expression = "Name"; Descending = $false } |
    Select-Object -First 5 |
    ForEach-Object { $songKeyToSlug[$_.Name] }

  $lines = New-Object "System.Collections.Generic.List[string]"
  $lines.Add("---")
  $lines.Add("title: $(Quote-Yaml $title)")
  $lines.Add("slug: $(Quote-Yaml $slug)")
  $lines.Add("date_range: [$(Quote-Yaml $startDate), $(Quote-Yaml $endDate)]")
  $lines.Add("description: null")
  if ($recommended.Count -eq 0) {
    $lines.Add("recommended: []")
  }
  else {
    $lines.Add("recommended:")
    foreach ($entry in $recommended) {
      $lines.Add("  - $(Quote-Yaml $entry)")
    }
  }
  $lines.Add("---")
  $lines.Add("")
  $lines.Add("## Notes")
  $lines.Add("")
  $lines.Add("Imported from ``$importCsvLabel``. Add planning notes, liturgical emphasis, and playlist ideas.")

  $seriesPath = Join-Path $seriesDir ($slug + ".md")
  Set-Content -Path $seriesPath -Value (($lines -join "`n") + "`n") -Encoding utf8
  $writtenSeries += 1
}

$songFiles = Get-ChildItem $songsDir -File -Filter "*.md" | Where-Object { $_.Name -ne "_template.md" } | ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) }
$songSlugSet = New-Object "System.Collections.Generic.HashSet[string]"
foreach ($slug in $songFiles) {
  [void]$songSlugSet.Add($slug)
}
$missingRefs = 0
foreach ($group in $serviceGroups) {
  foreach ($item in $group.Group) {
    $slug = $songKeyToSlug[$item.SongKey]
    if (-not $songSlugSet.Contains($slug)) {
      $missingRefs += 1
    }
  }
}

Write-Output "processed_rows=$($processed.Count)"
Write-Output "song_records=$($songRecords.Count)"
Write-Output "created_songs=$createdSongs"
Write-Output "written_services=$writtenServices"
Write-Output "removed_stale_services=$removedServices"
Write-Output "written_series=$writtenSeries"
Write-Output "missing_song_refs=$missingRefs"
