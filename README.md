## About
This is a small script that runs on AWS Lambda every **{{ interval }}**.

Logic:
- Download awesome lists
- Loop through them
- Remove some parts
- Find and grab all github links
- Get stars count for every github repo
- Update list with stars
- Add new description
- Create/Update repo for awesome list with stars

## Awesome lists with stars:

- Awesome go:
  - [Original repo](https://github.com/avelino/awesome-go)
  - [With stars](https://github.com/amanbolat/awesome-go-with-stars)
  