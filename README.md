```markdown
# Build and Push Docker Image Action

This GitHub Action builds and pushes a Docker image to a Docker registry. It uses Docker to build the image from a specified context directory, tags the image with a version and the latest tag, and pushes both tags to the Docker registry.

## Inputs

### `username`

**Required** The username for the Docker registry.

### `password`

**Required** The password for the Docker registry.

### `path`

**Optional** The path to the Docker context directory. Default is `.`.

### `registry`

**Required** The Docker registry URL.

### `owner`

**Required** The owner of the Docker repository.

## Example Usage

```yaml
name: Build and Push Docker Image

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Build and Push Docker Image
        uses: Punga78/gitea-docker-build-and-push-version
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
          registry: 'gitea.com'
          owner: 'Punga78'
          path: '.'
```

## Details

This action performs the following steps:

1. Retrieves the input parameters.
2. Reads the `package.json` and optionally `build-info.json` from the specified context path.
3. Constructs the Docker image name and tags.
4. Builds the Docker image using `docker buildx build`.
5. Tags the image with both the version and latest tags.
6. Pushes both tags to the Docker registry.

If the `build-info.json` file does not exist, the build number defaults to `0`.

## Note

Ensure that you have the required secrets `DOCKER_USERNAME` and `DOCKER_PASSWORD` set in your GitHub repository settings. These will be used to authenticate with the Docker registry.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

