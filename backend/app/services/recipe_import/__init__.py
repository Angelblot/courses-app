"""Import automatique de recettes depuis un lien web ou une photo de fiche."""
from app.services.recipe_import.service import import_from_photo, import_from_url
from app.services.recipe_import.web import RecipeImportError

__all__ = ["RecipeImportError", "import_from_photo", "import_from_url"]
