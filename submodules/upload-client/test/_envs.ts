import { config } from 'dotenv'

if (process.env.TEST_ENV === 'production') {
  config()
}
