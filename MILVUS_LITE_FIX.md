# 修复 Milvus Lite pkg_resources 问题

## 问题原因
Milvus Lite 依赖 `pkg_resources` 模块，但该模块在新版本 setuptools 中已被移除。

## 修复方法
修改 `.venv/lib/python3.12/site-packages/milvus_lite/__init__.py`：

将：
```python
from pkg_resources import DistributionNotFound, get_distribution
```

改为：
```python
try:
    from importlib.metadata import version, PackageNotFoundError
except ImportError:
    from importlib_metadata import version, PackageNotFoundError
```

并将：
```python
with suppress(DistributionNotFound):
    __version__ = get_distribution("milvus_lite").version
```

改为：
```python
with suppress(PackageNotFoundError):
    __version__ = version("milvus_lite")
```

## 长期解决方案
建议向 Milvus Lite 项目提交 PR，使用 importlib.metadata 替代 pkg_resources。
