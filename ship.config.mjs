import fs from 'fs'
import path from 'path'

export default {
  buildCommand: () => 'npm run build',
  publishCommand: ({ defaultCommand }) => `${defaultCommand} --access public`,
  versionUpdated: ({ version, dir }) => {
    function generateEnvFile(variables) {
      let template = fs.readFileSync(path.join(dir, './env.template.js')).toString();
      template = template.replaceAll(/{{(.+?)}}/g, (match, p1) => {
        return variables[p1];
      });
      fs.writeFileSync(path.join(dir, './env.js'), template);
    }

    generateEnvFile({ packageVersion: version });
  }
};
