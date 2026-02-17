# Contributing to Heureum

Thank you for your interest in contributing to Heureum!

## Development Setup

1. Fork the repository
2. Clone your fork
3. Follow the setup instructions in [SETUP.md](SETUP.md)
4. Create a new branch for your feature/fix

```bash
git checkout -b feature/your-feature-name
```

## Code Standards

### Python (Agent, Platform)

- Follow PEP 8 style guide
- Use type hints for all functions
- Format code with Black (line length: 100)
- Lint with Ruff
- Type-check with mypy

```bash
# In heureum-agent or heureum-platform
poetry run black .
poetry run ruff check .
poetry run mypy .
```

### TypeScript/JavaScript (Frontend, Client)

- Follow ESLint configuration
- Use TypeScript for all new code
- Use functional components with hooks
- Keep components small and focused

```bash
# In heureum-frontend or heureum-client
pnpm lint
```

## Testing

Write tests for all new features:

```bash
# Python tests
poetry run pytest

# TypeScript tests
pnpm test
```

## Commit Messages

Use conventional commits format:

```
feat: add new feature
fix: fix bug
docs: update documentation
style: format code
refactor: refactor code
test: add tests
chore: update dependencies
```

## Pull Requests

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update CHANGELOG.md
5. Submit PR with clear description

## Code Review Process

1. All PRs require review
2. CI must pass
3. Code must follow standards
4. Tests must pass

## Questions?

Open an issue for questions or discussions.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
