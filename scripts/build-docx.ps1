param(
  [string]$DocsDir = (Join-Path $PSScriptRoot "..\docs"),
  [string]$OutputDir = (Join-Path $PSScriptRoot "..\deliverables"),
  [string]$OutputName = "RAG-Chatbot-Technical-Documentation.docx"
)

$ErrorActionPreference = "Stop"

function Escape-Xml([string]$Value) {
  if ($null -eq $Value) { return "" }
  return [System.Security.SecurityElement]::Escape($Value)
}

function Clean-InlineMarkdown([string]$Value) {
  if ($null -eq $Value) { return "" }
  return $Value.Replace([string][char]96, "")
}

function Write-TextFile([string]$Path, [string]$Value) {
  [System.IO.File]::WriteAllText($Path, $Value, [System.Text.Encoding]::UTF8)
}

function Para([string]$Text, [string]$Style = "BodyText") {
  $safe = Escape-Xml $Text
  return "<w:p><w:pPr><w:pStyle w:val=`"$Style`"/></w:pPr><w:r><w:t xml:space=`"preserve`">$safe</w:t></w:r></w:p>"
}

function Heading([string]$Text, [int]$Level) {
  $style = "Heading$Level"
  $safe = Escape-Xml $Text
  return "<w:p><w:pPr><w:pStyle w:val=`"$style`"/></w:pPr><w:r><w:t xml:space=`"preserve`">$safe</w:t></w:r></w:p>"
}

function Bullet([string]$Text) {
  $safe = Escape-Xml $Text
  return "<w:p><w:pPr><w:pStyle w:val=`"ListBullet`"/></w:pPr><w:r><w:t xml:space=`"preserve`">$safe</w:t></w:r></w:p>"
}

function Numbered([string]$Text) {
  $safe = Escape-Xml $Text
  return "<w:p><w:pPr><w:pStyle w:val=`"ListNumber`"/></w:pPr><w:r><w:t xml:space=`"preserve`">$safe</w:t></w:r></w:p>"
}

function CodePara([string]$Text) {
  $safe = Escape-Xml $Text
  return "<w:p><w:pPr><w:pStyle w:val=`"CodeBlock`"/></w:pPr><w:r><w:t xml:space=`"preserve`">$safe</w:t></w:r></w:p>"
}

function PageBreak() {
  return "<w:p><w:r><w:br w:type=`"page`"/></w:r></w:p>"
}

function TableXml([string[]]$Rows) {
  $xml = "<w:tbl><w:tblPr><w:tblStyle w:val=`"DocTable`"/><w:tblW w:w=`"0`" w:type=`"auto`"/><w:tblBorders><w:top w:val=`"single`" w:sz=`"6`" w:space=`"0`" w:color=`"D7DEE8`"/><w:left w:val=`"single`" w:sz=`"6`" w:space=`"0`" w:color=`"D7DEE8`"/><w:bottom w:val=`"single`" w:sz=`"6`" w:space=`"0`" w:color=`"D7DEE8`"/><w:right w:val=`"single`" w:sz=`"6`" w:space=`"0`" w:color=`"D7DEE8`"/><w:insideH w:val=`"single`" w:sz=`"6`" w:space=`"0`" w:color=`"D7DEE8`"/><w:insideV w:val=`"single`" w:sz=`"6`" w:space=`"0`" w:color=`"D7DEE8`"/></w:tblBorders></w:tblPr>"
  $rowIndex = 0
  foreach ($row in $Rows) {
    if ($row.Trim() -match '^\|?[\s:\-|\|]+\|?$') { continue }
    $cells = $row.Trim().Trim("|").Split("|") | ForEach-Object { $_.Trim() }
    $xml += "<w:tr>"
    foreach ($cell in $cells) {
      $shade = if ($rowIndex -eq 0) { "<w:shd w:fill=`"172033`"/>" } else { "" }
      $color = if ($rowIndex -eq 0) { "<w:color w:val=`"FFFFFF`"/><w:b/>" } else { "" }
      $safe = Escape-Xml (Clean-InlineMarkdown $cell)
      $xml += "<w:tc><w:tcPr>$shade<w:tcMar><w:top w:w=`"120`" w:type=`"dxa`"/><w:left w:w=`"120`" w:type=`"dxa`"/><w:bottom w:w=`"120`" w:type=`"dxa`"/><w:right w:w=`"120`" w:type=`"dxa`"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr>$color</w:rPr><w:t xml:space=`"preserve`">$safe</w:t></w:r></w:p></w:tc>"
    }
    $xml += "</w:tr>"
    $rowIndex++
  }
  $xml += "</w:tbl>"
  return $xml
}

function Convert-Markdown([string]$Path) {
  $lines = Get-Content -Path $Path
  $out = New-Object System.Collections.Generic.List[string]
  $inCode = $false
  $tableRows = New-Object System.Collections.Generic.List[string]

  function Flush-Table {
    if ($tableRows.Count -gt 0) {
      $out.Add((TableXml $tableRows.ToArray()))
      $tableRows.Clear()
    }
  }

  foreach ($line in $lines) {
    if ($line.Trim().StartsWith(([string][char]96) * 3)) {
      Flush-Table
      $inCode = -not $inCode
      continue
    }

    if ($inCode) {
      $out.Add((CodePara $line))
      continue
    }

    if ($line.Trim() -match '^\|.*\|$') {
      $tableRows.Add($line)
      continue
    }
    Flush-Table

    if ([string]::IsNullOrWhiteSpace($line)) {
      $out.Add("<w:p/>")
      continue
    }

    if ($line -match '^(#{1,4})\s+(.+)$') {
      $level = [Math]::Min($matches[1].Length, 3)
      $out.Add((Heading ((Clean-InlineMarkdown $matches[2]).Trim()) $level))
      continue
    }

    if ($line -match '^\-\s+(.+)$') {
      $out.Add((Bullet ((Clean-InlineMarkdown $matches[1]).Trim())))
      continue
    }

    if ($line -match '^\d+\.\s+(.+)$') {
      $out.Add((Numbered ((Clean-InlineMarkdown $matches[1]).Trim())))
      continue
    }

    $out.Add((Para ((Clean-InlineMarkdown $line).Trim())))
  }
  Flush-Table
  return ($out -join "`n")
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$temp = Join-Path $env:TEMP ("rag-docx-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $temp | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $temp "_rels") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $temp "word") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $temp "docProps") | Out-Null

$files = Get-ChildItem -Path $DocsDir -Filter "*.md" | Sort-Object Name
$body = New-Object System.Collections.Generic.List[string]

$body.Add("<w:p><w:pPr><w:pStyle w:val=`"Title`"/></w:pPr><w:r><w:t>RAG Chatbot Technical Documentation</w:t></w:r></w:p>")
$body.Add("<w:p><w:pPr><w:pStyle w:val=`"Subtitle`"/></w:pPr><w:r><w:t>Architecture, Widget Integration, API Flows, Deployment, and Operations</w:t></w:r></w:p>")
$body.Add("<w:p><w:pPr><w:pStyle w:val=`"BodyText`"/></w:pPr><w:r><w:t>Generated from the project documentation in RAG-System/docs.</w:t></w:r></w:p>")
$body.Add((Heading "Document Set" 1))
foreach ($file in $files) {
  $title = ((Get-Content -Path $file.FullName -TotalCount 1) -replace '^#\s+', '').Trim()
  $body.Add((Bullet $title))
}
$body.Add((PageBreak))

for ($i = 0; $i -lt $files.Count; $i++) {
  $body.Add((Convert-Markdown $files[$i].FullName))
  if ($i -lt ($files.Count - 1)) {
    $body.Add((PageBreak))
  }
}

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    $($body -join "`n")
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

$stylesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:after="180"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:color w:val="172033"/><w:sz w:val="44"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:spacing w:after="420"/></w:pPr><w:rPr><w:color w:val="526175"/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="BodyText"><w:name w:val="Body Text"/><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="320" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:color w:val="0F5E68"/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="172033"/><w:sz w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:pPr><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="334155"/><w:sz w:val="23"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:pPr><w:ind w:left="360" w:hanging="180"/><w:spacing w:after="80"/></w:pPr><w:rPr><w:sz w:val="21"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:pPr><w:ind w:left="360" w:hanging="180"/><w:spacing w:after="80"/></w:pPr><w:rPr><w:sz w:val="21"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:pPr><w:shd w:fill="F1F5F9"/><w:spacing w:before="20" w:after="20"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="172033"/><w:sz w:val="18"/></w:rPr></w:style>
  <w:style w:type="table" w:styleId="DocTable"><w:name w:val="Doc Table"/><w:tblPr><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>
"@

$contentTypes = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

$rels = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

$docRels = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"@

$core = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>RAG Chatbot Technical Documentation</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$(Get-Date -Format s)Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$(Get-Date -Format s)Z</dcterms:modified>
</cp:coreProperties>
"@

$app = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex DOCX Generator</Application>
</Properties>
"@

Write-TextFile (Join-Path $temp "[Content_Types].xml") $contentTypes
Write-TextFile (Join-Path $temp "_rels\.rels") $rels
Write-TextFile (Join-Path $temp "word\document.xml") $documentXml
Write-TextFile (Join-Path $temp "word\styles.xml") $stylesXml
New-Item -ItemType Directory -Force -Path (Join-Path $temp "word\_rels") | Out-Null
Write-TextFile (Join-Path $temp "word\_rels\document.xml.rels") $docRels
Write-TextFile (Join-Path $temp "docProps\core.xml") $core
Write-TextFile (Join-Path $temp "docProps\app.xml") $app

$outputPath = Join-Path $OutputDir $OutputName
if (Test-Path $outputPath) {
  Remove-Item -LiteralPath $outputPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($temp, $outputPath)
Remove-Item -LiteralPath $temp -Recurse -Force

Write-Host $outputPath
