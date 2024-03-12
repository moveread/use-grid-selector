default:
  @just --list

# Deploy 'demo' into GitHub Pages
deploy-demo:
  gh workflow run deploy-demo.yml --ref main
