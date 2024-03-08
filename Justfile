# Build, increment patch number and publish
patch:
  rm -drf dist  || echo 'No previous dist'
  yarn build && yarn version --patch && npm publish

# Install a package as both --dev and --peer
extra PACKAGE:
  yarn add --peer {{PACKAGE}} && yarn add --dev {{PACKAGE}}