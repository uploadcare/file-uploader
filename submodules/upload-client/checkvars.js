import {config} from 'dotenv'
import chalk from 'chalk'

let VARS = ['UC_KEY_FOR_INTEGRATION_TESTS']

let check = () => {
  config()

  let undefinedVars = VARS.filter((variable) => process.env[variable] == null)
  if (undefinedVars.length !== 0) {
    console.log(
      chalk.red(
        `Please add ${chalk.bold(undefinedVars.join(', '))} to .env config`
      )
    )
    process.exit(1)
  }
}

check()
