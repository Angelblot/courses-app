"""Vérifie les migrations de données extraites du hook de démarrage."""

from app.core.bootstrap import (
    backfill_product_types,
    fix_charcuterie_categories,
    run_data_migrations,
)
from app.models.product import Product


def _product(db, **kwargs):
    defaults = {"name": "Produit", "category": "EPICERIE", "unit": "piece"}
    defaults.update(kwargs)
    product = Product(**defaults)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


class TestBackfillProductTypes:
    def test_renseigne_les_types_manquants(self, db_session):
        product = _product(db_session, name="Lardons fumés", product_type=None)

        assert backfill_product_types(db_session) == 1

        db_session.refresh(product)
        assert product.product_type is not None

    def test_ne_touche_pas_aux_types_deja_presents(self, db_session):
        product = _product(db_session, name="Lardons fumés", product_type="lardon")

        assert backfill_product_types(db_session) == 0

        db_session.refresh(product)
        assert product.product_type == "lardon"

    def test_est_idempotente(self, db_session):
        _product(db_session, name="Jambon blanc", product_type=None)

        assert backfill_product_types(db_session) == 1
        assert backfill_product_types(db_session) == 0


class TestFixCharcuterieCategories:
    def test_reclasse_la_charcuterie_mal_rangee(self, db_session):
        product = _product(
            db_session, name="Lardons", category="P.L.S.", product_type="lardon"
        )

        assert fix_charcuterie_categories(db_session) == 1

        db_session.refresh(product)
        assert product.category == "CHARCUT.TRAITEUR"

    def test_laisse_les_vrais_produits_pls(self, db_session):
        product = _product(
            db_session, name="Yaourt nature", category="P.L.S.", product_type="yaourt"
        )

        assert fix_charcuterie_categories(db_session) == 0

        db_session.refresh(product)
        assert product.category == "P.L.S."

    def test_ne_touche_pas_aux_autres_categories(self, db_session):
        product = _product(
            db_session, name="Chorizo", category="CHARCUT.TRAITEUR", product_type="chorizo"
        )

        assert fix_charcuterie_categories(db_session) == 0

        db_session.refresh(product)
        assert product.category == "CHARCUT.TRAITEUR"

    def test_est_idempotente(self, db_session):
        _product(db_session, name="Saucisson", category="P.L.S.", product_type="saucisson")

        assert fix_charcuterie_categories(db_session) == 1
        assert fix_charcuterie_categories(db_session) == 0


class TestRunDataMigrations:
    def test_applique_les_migrations_dans_l_ordre(self, db_session):
        # Sans product_type : seul l'enchaînement backfill → reclassement
        # permet de rattraper ce produit.
        product = _product(
            db_session, name="Lardons fumés", category="P.L.S.", product_type=None
        )

        applied = run_data_migrations(db_session)

        assert set(applied) == {"product_types", "charcuterie_categories"}
        db_session.refresh(product)
        assert product.category == "CHARCUT.TRAITEUR"

    def test_base_vide_ne_produit_aucune_ecriture(self, db_session):
        applied = run_data_migrations(db_session)
        assert applied == {"product_types": 0, "charcuterie_categories": 0}
