const { addCounts } = require('./count')

// note: modifies the tests in place
function pickTaggedTests(tests, tag) {
  if (!Array.isArray(tests)) {
    return false
  }
  const tags = Array.isArray(tag) ? tag : parseTagsGrep(tag) 
  const filteredTests = tests.filter((test) => {
    if (test.type === 'test') {
      return shouldTestRunTags(tags, test.tags)
    } else if (test.type === 'suite') {
      if (shouldTestRunTags(tags, test.tags)) {
        return true
      }

      // maybe there is some test inside this suite
      // with the tag? Filter all other tests
      return (
        pickTaggedTests(test.tests, tags) || pickTaggedTests(test.suites, tags)
      )
    }
  })
  tests.length = 0
  tests.push(...filteredTests)
  return filteredTests.length > 0
}

function removeEmptyNodes(json) {
  Object.keys(json).forEach((filename) => {
    const fileTests = json[filename].tests
    if (!fileTests.length) {
      delete json[filename]
    }
  })
  return json
}

/**
 * Takes an object of tests collected from all files,
 * and removes all tests that do not have the given tag applied.
 * Modifies the given object in place.
 */
function pickTaggedTestsFrom(json, tag) {
  Object.keys(json).forEach((filename) => {
    const fileTests = json[filename].tests
    pickTaggedTests(fileTests, tag)
  })

  const result = removeEmptyNodes(json)
  addCounts(result)
  return result
}

/**
 * Parses tags to grep for.
 * @param {string} s Tags string like "@tag1+@tag2"
 */
function parseTagsGrep(s) {
  if (!s) {
    return []
  }

  const explicitNotTags = []

  // top level split - using space or comma, each part is OR
  const ORS = s
    .split(/[ ,]/)
    // remove any empty tags
    .filter(Boolean)
    .map((part) => {
      // now every part is an AND
      if (part.startsWith('--')) {
        explicitNotTags.push({
          tag: part.slice(2),
          invert: true,
        })
        return
      }
      const parsed = part.split('+').map((tag) => {
        if (tag.startsWith('-')) {
          return {
            tag: tag.slice(1),
            invert: true,
          }
        }

        return {
          tag,
          invert: false,
        }
      })

      return parsed
    })

  // filter out undefined from explicit not tags
  const ORS_filtered = ORS.filter((x) => x !== undefined)
  if (explicitNotTags.length > 0) {
    ORS_filtered.forEach((OR, index) => {
      ORS_filtered[index] = OR.concat(explicitNotTags)
    })
  }
  return ORS_filtered
}

function shouldTestRunTags(parsedGrepTags, tags = []) {
  if (!parsedGrepTags.length) {
    // there are no parsed tags to search for, the test should run
    return true
  }

  // now the test has tags and the parsed tags are present

  // top levels are OR
  const onePartMatched = parsedGrepTags.some((orPart) => {
    const everyAndPartMatched = orPart.every((p) => {
      if (p.invert) {
        return !tags.includes(p.tag)
      }

      return tags.includes(p.tag)
    })
    // console.log('every part matched %o?', orPart, everyAndPartMatched)

    return everyAndPartMatched
  })

  // console.log('onePartMatched', onePartMatched)
  return onePartMatched
}

module.exports = {
  parseTagsGrep,
  shouldTestRunTags,
  pickTaggedTestsFrom,
  removeEmptyNodes,
  pickTaggedTests,
}
