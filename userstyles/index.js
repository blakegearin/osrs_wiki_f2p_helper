const fs = require('fs')
const path = require('path')

const packageJson = require('../package.json')

const VERSION = packageJson.version

const USER_STYLE_METADATA = (subtitle = null) => `/* ==UserStyle==
@name         OSRS Wiki F2P Helper${subtitle ? ` - ${subtitle}` : ''}
@namespace    https://blakegearin.com
@description  Updates styling of free-to-play and members' content on the Old School RuneScape Wiki.
@author       Blake Gearin <hello@blakeg.me> (https://github.com/blakegearin)
@homepageURL  https://github.com/blakegearin/osrs_wiki_f2p_helper
@supportURL   https://github.com/blakegearin/osrs_wiki_f2p_helper/issues
@version      ${VERSION}
@license      MIT
==/UserStyle== */
`

const config = {
  cssFilename: 'osrs_wiki_f2p_helper.user.css',
  tableRowsForMembers: {
    cssDeclaration: 'filter: opacity(0.25);'
  },
  linksMetadata: {
    member: {
      ignore: false,
      subtitle: "Members' Links",
      cssFilename: 'osrs_wiki_f2p_helper_member_links.user.css',
      linkColor: {
        key: 'member-link-color',
        value: {
          light: '#ae2a5b',
          dark: '#d3a1a1',
          browntown: '#b5718d'
        }
      },
      categories: [
        'Members',
        "Members' account builds",
        "Members' items",
        "Members' locations",
        "Members' monsters",
        "Members' music",
        "Members' NPCs",
        "Members' prayers",
        "Members' quests",
        "Members' scenery",
        "Members' shops",
        "Members' skills",
        "Members' spellbooks",
        "Members' spells",
        // Skills
        'Agility',
        'Construction',
        'Farming',
        'Fletching',
        'Herblore',
        'Hunter',
        'Slayer',
        'Thieving',
        // Other
        'Achievement diaries',
        'Dungeons',
        'Minigames',
        'Minigame items',
        'Miniquests',
        'Raids'
      ]
    },
    // F2P last so it can take precedence
    free_to_play: {
      ignore: false,
      subtitle: 'F2P Links',
      cssFilename: 'osrs_wiki_f2p_helper_f2p_links.user.css',
      linkColor: {
        key: 'f2p-link-color',
        value: {
          light: '#439339',
          dark: '#8cd4e6',
          browntown: '#95b77e'
        }
      },
      categories: [
        'Free-to-play',
        'Free-to-play account builds',
        'Free-to-play dungeons',
        'Free-to-play items',
        'Free-to-play locations',
        'Free-to-play minigames',
        'Free-to-play monsters',
        'Free-to-play music',
        'Free-to-play NPCs',
        'Free-to-play prayers',
        'Free-to-play quests',
        'Free-to-play scenery',
        'Free-to-play shops',
        'Free-to-play skills',
        'Free-to-play spells',
        // Other
        'Events',
        'Mechanics'
      ]
    }
  }
}

const WIKI_URL = 'https://oldschool.runescape.wiki'

async function fetchCategoryMembersBatch (allTitles, cmtitle, cmcontinue = null) {
  const params = {
    format: 'json',
    action: 'query',
    cmlimit: 500,
    list: 'categorymembers',
    cmprop: 'title',
    cmtitle
  }

  if (cmcontinue) params.cmcontinue = cmcontinue

  let apiUrl = WIKI_URL + '/api.php?origin=*'
  Object.keys(params).forEach((key) => { apiUrl += `&${key}=${params[key]}` })

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()

    allTitles.push(...data.query.categorymembers.map((page) => page.title))

    if (data.continue) await fetchCategoryMembersBatch(allTitles, cmtitle, data.continue.cmcontinue)
  } catch (error) {
    console.log(error)
  }

  return allTitles
}

async function generatePageTitleSelectorsFromCategory (categoryName) {
  const cmtitle = `Category:${categoryName}`
  const pageTitles = [cmtitle]

  await fetchCategoryMembersBatch(pageTitles, cmtitle)

  function escapePageTitle (pageTitle) {
    return encodeURIComponent(pageTitle)
      .replaceAll(/'/g, '%27')
      .replaceAll('%20', '_')
      .replaceAll('%2F', '/')
      .replaceAll('%2C', ',')
      .replaceAll('%3A', ':')
  }

  return pageTitles.map(
    (pageTitle) => {
      const escapedPageTitle = escapePageTitle(pageTitle)

      return `a[href="/w/${escapedPageTitle}"]`
    }
  )
}

async function generateCssRulesForCategory (linkColorVariableName, categoryName) {
  const pageTitleSelectors = await generatePageTitleSelectorsFromCategory(categoryName)
  const escapedCategoryName = categoryName.replaceAll(' ', '_')
  const categoryLink = `${WIKI_URL}/w/Category:${escapedCategoryName}`

  const cssRules = []
  const totalBatches = Math.ceil(pageTitleSelectors.length / 1000)
  let batchNumber = 1

  for (let i = 0; i < pageTitleSelectors.length; i += 1000) {
    const batchSelectors = pageTitleSelectors.slice(i, i + 1000)

    const batchCss = `
  /* Category: ${categoryName} */
  /* Link: "${categoryLink}" */
  /* Batch: ${batchNumber} of ${totalBatches} */
  ${batchSelectors.join(',\n  ')}
  {
    color: var(--${linkColorVariableName});
  }`

    cssRules.push(batchCss)
    batchNumber++
  }

  return cssRules.join('\n')
}

async function generateCssRulesForCategories ({ linkColor, categories }) {
  const linkColorVariableName = linkColor.key

  const cssRulesPromises = categories.map(
    async (categoryName) => { return generateCssRulesForCategory(linkColorVariableName, categoryName) }
  )

  return await Promise.all(cssRulesPromises)
}

function generateCssVariables (linkColors) {
  const lightVariables = []
  const darkVariables = []
  const browntownVariables = []

  linkColors.forEach((linkColor) => {
    const linkColorVariableName = linkColor.key

    lightVariables.push(`--${linkColorVariableName}: ${linkColor.value.light};`)
    darkVariables.push(`--${linkColorVariableName}: ${linkColor.value.dark};`)
    browntownVariables.push(`--${linkColorVariableName}: ${linkColor.value.browntown};`)
  })

  const lineBreaks = '\n    '

  return `body.wgl-theme-light
  {
    ${lightVariables.join(lineBreaks)}
  }

  body.wgl-theme-dark
  {
    ${darkVariables.join(lineBreaks)}
  }

  body.wgl-theme-browntown
  {
    ${browntownVariables.join(lineBreaks)}
  }`
}

function generateCssFile (cssFilename, cssContent, subtitle = null) {
  const wrappedCssContent = `
@-moz-document domain("oldschool.runescape.wiki") {
  ${cssContent}
}
`
  const cssDirectory = path.join(__dirname, 'css')

  fs.writeFile(
    path.join(cssDirectory, cssFilename),
    USER_STYLE_METADATA(subtitle) + wrappedCssContent,
    (error) => {
      if (error) {
        console.error('Error writing CSS file:', error)
      } else {
        console.log(`Successfully created CSS file: ${cssFilename}`)
      }
    }
  )
}

async function generateCssObjectForConfigValue ({ ignore, linkColor, categories }) {
  if (ignore) return {}

  const variables = generateCssVariables([linkColor])
  const rules = await generateCssRulesForCategories({ linkColor, categories })

  return {
    variables,
    rules
  }
}

async function generateCssFiles (config) {
  const cssContents = []

  const linksMetadata = Object.values(config.linksMetadata)

  for (let i = 0; i < linksMetadata.length; i++) {
    const linkMetadata = linksMetadata[i]

    const cssObject = await generateCssObjectForConfigValue(linkMetadata)
    cssContents.push(cssObject)

    const cssContent = [
      cssObject.variables,
      cssObject.rules.join('\n')
    ].join('\n')

    generateCssFile(linkMetadata.cssFilename, cssContent, linkMetadata.subtitle)
  }

  const linksVariables = generateCssVariables(
    linksMetadata.map((value) => value.linkColor)
  )
  const linksRules = cssContents.map((cssContent) => cssContent.rules.join('\n')).join('\n')

  const tableRowsForMembersRule = `
  /* Modify table rows that contain a link to the Members page but not the F2P page */
  /* :has() support is ramping up: https://caniuse.com/css-has */
  table:not(.infobox) tr:has(a[href="/w/Members"]):not(:has(a[href="/w/Free-to-play"]))
  {
    ${config.tableRowsForMembers.cssDeclaration}
  }`

  const allCssContent = [
    linksVariables,
    tableRowsForMembersRule,
    linksRules
  ].join('\n')

  generateCssFile(config.cssFilename, allCssContent)
}

generateCssFiles(config)
