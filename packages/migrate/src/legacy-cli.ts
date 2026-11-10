#!/usr/bin/env node

// Entry for the `migrate-auto-routes` bin still shipped inside
// `react-router-auto-routes` 1.x. Removed together with that bin in v2.
import { main } from './cli/main'

main(process.argv.slice(2), { legacyBin: true })
