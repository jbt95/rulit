# Contributing to Rulit

Thank you for your interest in contributing to Rulit! We welcome contributions from everyone.

## How to Contribute

1.  **Report Bugs**: If you find a bug, please open an issue on GitHub.
2.  **Suggest Features**: Have an idea for a new feature? Open an issue to discuss it.
3.  **Submit Pull Requests**:
    - Fork the repository.
    - Create a new branch for your changes.
    - Make your changes and add tests if applicable.
    - Ensure all tests pass by running `pnpm run ci`.
    - Submit a pull request with a clear description of your changes.

## Development Setup

1.  Clone the repository:
    ```sh
    git clone https://github.com/jbt95/rulit.git
    cd rulit
    ```
2.  Install dependencies:
    ```sh
    pnpm install
    ```
3.  Run tests:
    ```sh
    pnpm test
    ```
4.  Run type checks:
    ```sh
    pnpm run typecheck
    ```
5.  Check formatting:
    ```sh
    pnpm run format:check
    ```

## Code Style

We use Prettier for code formatting. You can format the code by running:

```sh
pnpm run format
```

## License

By contributing to Rulit, you agree that your contributions will be licensed under the MIT License.
