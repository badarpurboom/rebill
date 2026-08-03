from django.db import models


class TableStatus(models.TextChoices):
    AVAILABLE = 'AVAILABLE', 'Available'   # green
    OCCUPIED = 'OCCUPIED', 'Occupied'      # red — running order
    BILLED = 'BILLED', 'Billed'            # orange — bill printed, payment pending


class TableShape(models.TextChoices):
    SQUARE = 'SQUARE', 'Square'
    ROUND = 'ROUND', 'Round'
    RECT = 'RECT', 'Rectangle'


class RestaurantTable(models.Model):
    """A physical table on the floor map.

    `pos_x` / `pos_y` are grid cells, not pixels — the owner drags on a snapped
    grid, so the layout renders identically on a laptop and a tablet.
    """

    number = models.CharField(max_length=10, unique=True)
    label = models.CharField(max_length=40, blank=True, help_text='e.g. Garden Side')
    seats = models.PositiveSmallIntegerField(default=4)
    shape = models.CharField(max_length=6, choices=TableShape.choices, default=TableShape.SQUARE)

    pos_x = models.PositiveSmallIntegerField(default=0)
    pos_y = models.PositiveSmallIntegerField(default=0)

    status = models.CharField(
        max_length=10, choices=TableStatus.choices, default=TableStatus.AVAILABLE
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'restaurant_tables'
        ordering = ['pos_y', 'pos_x', 'number']

    def __str__(self):
        return f'Table {self.number}'

    @property
    def is_free(self):
        return self.status == TableStatus.AVAILABLE

    def mark(self, status):
        if self.status != status:
            self.status = status
            self.save(update_fields=['status'])
